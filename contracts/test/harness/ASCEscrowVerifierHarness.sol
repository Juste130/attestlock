// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ASCEscrowVerifier} from "../../src/creditcoin/ASCEscrowVerifier.sol";

/// @dev FR : Le precompile Block Prover (0x0FD2) n'existe pas dans l'EVM locale de Foundry --
///      il n'existe que sur Creditcoin. Ce harness expose donc directement `_processAndEmitEvent`
///      (le code qu'on controle et qu'on veut tester), en contournant `ASCBase.execute` (le code
///      qu'on ne peut de toute facon pas tester sans le vrai precompile). La verification
///      cryptographique elle-meme est validee separement sur testnet (etape 7).
///      EN : The Block Prover precompile (0x0FD2) does not exist in Foundry's local EVM -- it
///      only exists on Creditcoin. This harness therefore exposes `_processAndEmitEvent`
///      directly (the code we control and want to test), bypassing `ASCBase.execute` (the code
///      we can't test locally without the real precompile anyway). Cryptographic verification
///      itself is validated separately on testnet (step 7).
contract ASCEscrowVerifierHarness is ASCEscrowVerifier {
    constructor(address _escrow) ASCEscrowVerifier(_escrow) {}

    function exposeProcessAndEmitEvent(uint8 action, bytes32 queryId, bytes memory encodedTransaction) external {
        _processAndEmitEvent(action, queryId, encodedTransaction);
    }
}
