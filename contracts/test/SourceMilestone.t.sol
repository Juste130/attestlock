// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SourceMilestone} from "../src/source/SourceMilestone.sol";

contract SourceMilestoneTest is Test {
    SourceMilestone internal sourceMilestone;
    address internal client = makeAddr("client");

    function setUp() public {
        sourceMilestone = new SourceMilestone();
    }

    function test_ConfirmMilestone_EmitsEventWithSigner() public {
        uint256 escrowId = 42;

        vm.expectEmit(true, true, false, false, address(sourceMilestone));
        emit SourceMilestone.MilestoneConfirmed(escrowId, client);

        vm.prank(client);
        sourceMilestone.confirmMilestone(escrowId);
    }

    function test_ConfirmMilestone_AnyEscrowId() public {
        // FR : Le contrat n'a aucune notion de "quel escrow existe" -- cette validation est
        //      faite cote Creditcoin par ASCEscrowVerifier + Escrow. Ici on verifie juste que
        //      n'importe quel id est accepte sans revert, conformement au design minimal voulu.
        // EN : The contract has no notion of "which escrow exists" -- that validation happens
        //      on the Creditcoin side via ASCEscrowVerifier + Escrow. Here we just check that
        //      any id is accepted without reverting, matching the intended minimal design.
        vm.prank(client);
        sourceMilestone.confirmMilestone(0);
    }
}
