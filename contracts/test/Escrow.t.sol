// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "../src/creditcoin/Escrow.sol";

/// @dev FR : Tests unitaires de la logique de garde des fonds, independamment de toute preuve
///      cross-chain -- on simule l'ASC avec une adresse quelconque enregistree via
///      `registerASCVerifier`, ce qui suffit a exercer tous les chemins de `Escrow.sol`.
///      EN : Unit tests for the fund-custody logic, independent of any cross-chain proof -- the
///      ASC is simulated with an arbitrary address registered via `registerASCVerifier`, which
///      is enough to exercise every path in `Escrow.sol`.
contract EscrowTest is Test {
    Escrow internal escrow;

    address internal owner = makeAddr("owner");
    address internal ascVerifier = makeAddr("ascVerifier");
    address internal client = makeAddr("client");
    address internal freelancer = makeAddr("freelancer");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant DURATION = 7 days;
    uint256 internal constant DEPOSIT_AMOUNT = 1 ether;

    function setUp() public {
        vm.prank(owner);
        escrow = new Escrow();

        vm.prank(owner);
        escrow.registerASCVerifier(ascVerifier);
    }

    function _createEscrow() internal returns (uint256 id) {
        vm.prank(client);
        id = escrow.createEscrow(freelancer, DURATION);
    }

    function _createAndFundEscrow() internal returns (uint256 id) {
        id = _createEscrow();
        vm.deal(client, DEPOSIT_AMOUNT);
        vm.prank(client);
        escrow.deposit{value: DEPOSIT_AMOUNT}(id);
    }

    // ---------------------------------------------------------------
    // createEscrow
    // ---------------------------------------------------------------

    function test_CreateEscrow_StoresAgreement() public {
        uint256 id = _createEscrow();

        Escrow.Agreement memory agreement = escrow.checkEscrow(id);
        assertEq(agreement.client, client);
        assertEq(agreement.freelancer, freelancer);
        assertEq(agreement.amount, 0);
        assertEq(uint8(agreement.state), uint8(Escrow.EscrowState.Active));
    }

    function test_CreateEscrow_RevertsIfFreelancerIsZero() public {
        vm.prank(client);
        vm.expectRevert("Freelancer cannot be the zero address");
        escrow.createEscrow(address(0), DURATION);
    }

    function test_CreateEscrow_RevertsIfFreelancerIsClient() public {
        vm.prank(client);
        vm.expectRevert("Client and freelancer must be different addresses");
        escrow.createEscrow(client, DURATION);
    }

    // ---------------------------------------------------------------
    // deposit
    // ---------------------------------------------------------------

    function test_Deposit_LocksFunds() public {
        uint256 id = _createEscrow();
        vm.deal(client, DEPOSIT_AMOUNT);

        vm.prank(client);
        escrow.deposit{value: DEPOSIT_AMOUNT}(id);

        Escrow.Agreement memory agreement = escrow.checkEscrow(id);
        assertEq(agreement.amount, DEPOSIT_AMOUNT);
        assertEq(address(escrow).balance, DEPOSIT_AMOUNT);
    }

    function test_Deposit_RevertsIfNotClient() public {
        uint256 id = _createEscrow();
        vm.deal(stranger, DEPOSIT_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert("Only the client of this escrow can deposit");
        escrow.deposit{value: DEPOSIT_AMOUNT}(id);
    }

    function test_Deposit_RevertsOnSecondDeposit() public {
        uint256 id = _createAndFundEscrow();
        vm.deal(client, DEPOSIT_AMOUNT);

        vm.prank(client);
        vm.expectRevert("Escrow already funded");
        escrow.deposit{value: DEPOSIT_AMOUNT}(id);
    }

    function test_Deposit_RevertsIfZeroValue() public {
        uint256 id = _createEscrow();

        vm.prank(client);
        vm.expectRevert("Deposit must be greater than 0");
        escrow.deposit{value: 0}(id);
    }

    // ---------------------------------------------------------------
    // releaseFunds (appelee normalement par ASCEscrowVerifier / normally called by ASCEscrowVerifier)
    // ---------------------------------------------------------------

    function test_ReleaseFunds_RevertsIfCallerIsNotASCVerifier() public {
        uint256 id = _createAndFundEscrow();

        vm.prank(stranger);
        vm.expectRevert("Only the registered ASC verifier can call this");
        escrow.releaseFunds(id, client);
    }

    function test_ReleaseFunds_TransfersToFreelancer() public {
        uint256 id = _createAndFundEscrow();
        uint256 freelancerBalanceBefore = freelancer.balance;

        vm.prank(ascVerifier);
        escrow.releaseFunds(id, client);

        assertEq(freelancer.balance, freelancerBalanceBefore + DEPOSIT_AMOUNT);
        Escrow.Agreement memory agreement = escrow.checkEscrow(id);
        assertEq(uint8(agreement.state), uint8(Escrow.EscrowState.Unlocked));
    }

    function test_ReleaseFunds_RevertsIfConfirmedByNotClient() public {
        uint256 id = _createAndFundEscrow();

        vm.prank(ascVerifier);
        vm.expectRevert("Milestone was not confirmed by the registered client");
        escrow.releaseFunds(id, stranger);
    }

    // ---------------------------------------------------------------
    // refund
    // ---------------------------------------------------------------

    function test_Refund_ReturnsFundsAfterDeadline() public {
        uint256 id = _createAndFundEscrow();
        uint256 clientBalanceBefore = client.balance;

        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(client);
        escrow.refund(id);

        assertEq(client.balance, clientBalanceBefore + DEPOSIT_AMOUNT);
        Escrow.Agreement memory agreement = escrow.checkEscrow(id);
        assertEq(uint8(agreement.state), uint8(Escrow.EscrowState.Refunded));
    }

    function test_Refund_RevertsBeforeDeadline() public {
        uint256 id = _createAndFundEscrow();

        vm.prank(client);
        vm.expectRevert("Deadline has not passed yet");
        escrow.refund(id);
    }

    function test_Refund_RevertsIfAlreadyUnlocked() public {
        uint256 id = _createAndFundEscrow();

        vm.prank(ascVerifier);
        escrow.releaseFunds(id, client);

        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(client);
        vm.expectRevert("Escrow is not active");
        escrow.refund(id);
    }
}
