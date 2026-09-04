// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "../src/creditcoin/Escrow.sol";
import {ASCEscrowVerifier} from "../src/creditcoin/ASCEscrowVerifier.sol";
import {ASCEscrowVerifierHarness} from "./harness/ASCEscrowVerifierHarness.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {EventSignatures} from "../src/common/EventSignatures.sol";

/// @dev FR : Verifie que `_processAndEmitEvent` fait exactement ce qu'il faut UNE FOIS que la
///      preuve cryptographique est deja validee (c'est le role de `ASCBase.execute`, non teste
///      ici -- voir ASCEscrowVerifierHarness.sol). On construit ici a la main des octets de
///      transaction Sepolia "prouvee" (`encodedTransaction`) au format attendu par
///      `EvmV1Decoder`, pour simuler ce que le precompile aurait produit.
///      EN : Verifies that `_processAndEmitEvent` does exactly the right thing ONCE the
///      cryptographic proof is already validated (that's `ASCBase.execute`'s job, not tested
///      here -- see ASCEscrowVerifierHarness.sol). Here we hand-build "proved" Sepolia
///      transaction bytes (`encodedTransaction`) in the format `EvmV1Decoder` expects, to
///      simulate what the precompile would have produced.
contract ASCEscrowVerifierTest is Test {
    Escrow internal escrow;
    ASCEscrowVerifierHarness internal ascVerifier;

    address internal owner = makeAddr("owner");
    address internal client = makeAddr("client");
    address internal freelancer = makeAddr("freelancer");
    address internal sourceMilestoneContract = makeAddr("sourceMilestoneContract");
    address internal spoofedSourceContract = makeAddr("spoofedSourceContract");

    uint256 internal constant DEPOSIT_AMOUNT = 1 ether;
    uint8 internal constant ACTION_MILESTONE_CONFIRMED = 0;
    uint8 internal constant ACTION_UNKNOWN = 1;

    function setUp() public {
        vm.startPrank(owner);
        escrow = new Escrow();
        ascVerifier = new ASCEscrowVerifierHarness(address(escrow));
        escrow.registerASCVerifier(address(ascVerifier));
        ascVerifier.registerSourceMilestoneContract(sourceMilestoneContract);
        vm.stopPrank();

        vm.prank(client);
        uint256 id = escrow.createEscrow(freelancer, 7 days);
        assertEq(id, 1);

        vm.deal(client, DEPOSIT_AMOUNT);
        vm.prank(client);
        escrow.deposit{value: DEPOSIT_AMOUNT}(1);
    }

    function test_ProcessAndEmitEvent_ReleasesFundsOnValidProof() public {
        bytes memory encodedTx = _buildEncodedTransaction(
            _milestoneLog(sourceMilestoneContract, 1, client),
            1 // receiptStatus = success
        );

        uint256 freelancerBalanceBefore = freelancer.balance;

        ascVerifier.exposeProcessAndEmitEvent(ACTION_MILESTONE_CONFIRMED, bytes32(uint256(1)), encodedTx);

        assertEq(freelancer.balance, freelancerBalanceBefore + DEPOSIT_AMOUNT);
        Escrow.Agreement memory agreement = escrow.checkEscrow(1);
        assertEq(uint8(agreement.state), uint8(Escrow.EscrowState.Unlocked));
    }

    function test_RevertsIfSourceTransactionFailed() public {
        bytes memory encodedTx = _buildEncodedTransaction(
            _milestoneLog(sourceMilestoneContract, 1, client),
            0 // receiptStatus = failure
        );

        vm.expectRevert("Source transaction did not succeed");
        ascVerifier.exposeProcessAndEmitEvent(ACTION_MILESTONE_CONFIRMED, bytes32(uint256(1)), encodedTx);
    }

    function test_RevertsIfEventEmittedByUnregisteredContract() public {
        bytes memory encodedTx = _buildEncodedTransaction(
            _milestoneLog(spoofedSourceContract, 1, client),
            1
        );

        vm.expectRevert("Event not emitted by the registered source contract");
        ascVerifier.exposeProcessAndEmitEvent(ACTION_MILESTONE_CONFIRMED, bytes32(uint256(1)), encodedTx);
    }

    function test_RevertsIfNoMilestoneEventPresent() public {
        EvmV1Decoder.LogEntryTuple[] memory noLogs = new EvmV1Decoder.LogEntryTuple[](0);
        bytes memory encodedTx = _buildEncodedTransactionWithLogs(noLogs, 1);

        vm.expectRevert("No MilestoneConfirmed event found in proved transaction");
        ascVerifier.exposeProcessAndEmitEvent(ACTION_MILESTONE_CONFIRMED, bytes32(uint256(1)), encodedTx);
    }

    function test_RevertsOnUnknownAction() public {
        bytes memory encodedTx = _buildEncodedTransaction(
            _milestoneLog(sourceMilestoneContract, 1, client),
            1
        );

        vm.expectRevert(abi.encodeWithSelector(ASCEscrowVerifier.UnknownAction.selector, ACTION_UNKNOWN));
        ascVerifier.exposeProcessAndEmitEvent(ACTION_UNKNOWN, bytes32(uint256(1)), encodedTx);
    }

    function test_RegisterSourceMilestoneContract_OnlyOwner() public {
        vm.prank(client);
        vm.expectRevert();
        ascVerifier.registerSourceMilestoneContract(sourceMilestoneContract);
    }

    // ---------------------------------------------------------------
    // Construction manuelle de "preuves" / manual proof construction
    // ---------------------------------------------------------------

    /// @dev FR : Reproduit l'encodage `abi.encode(uint8 txType, bytes[] chunks)` attendu par
    ///      `EvmV1Decoder`, avec un unique log `MilestoneConfirmed`. Les chunks 0 et 1 (champs
    ///      de transaction) sont laisses vides : `_extractMilestoneLogs` ne les lit jamais, seul
    ///      le dernier chunk (receipt) compte pour cette logique.
    ///      EN : Reproduces the `abi.encode(uint8 txType, bytes[] chunks)` encoding expected by
    ///      `EvmV1Decoder`, with a single `MilestoneConfirmed` log. Chunks 0 and 1 (transaction
    ///      fields) are left empty: `_extractMilestoneLogs` never reads them, only the last
    ///      chunk (receipt) matters for this logic.
    function _buildEncodedTransaction(EvmV1Decoder.LogEntryTuple memory log, uint8 receiptStatus)
        internal
        pure
        returns (bytes memory)
    {
        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = log;
        return _buildEncodedTransactionWithLogs(logs, receiptStatus);
    }

    function _buildEncodedTransactionWithLogs(EvmV1Decoder.LogEntryTuple[] memory logs, uint8 receiptStatus)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory receiptChunk = abi.encode(receiptStatus, uint64(21_000), logs, bytes(""));

        bytes[] memory chunks = new bytes[](3);
        chunks[0] = "";
        chunks[1] = "";
        chunks[2] = receiptChunk;

        return abi.encode(uint8(0), chunks); // txType 0 = legacy, suffisant pour ce test
    }

    function _milestoneLog(address emitter, uint256 escrowId, address confirmedBy)
        internal
        pure
        returns (EvmV1Decoder.LogEntryTuple memory)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = EventSignatures.MILESTONE_CONFIRMED;
        topics[1] = bytes32(escrowId);
        topics[2] = bytes32(uint256(uint160(confirmedBy)));

        return EvmV1Decoder.LogEntryTuple({address_: emitter, topics: topics, data: ""});
    }
}
