// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title EventSignatures
/// @notice FR : Signatures d'evenements partagees entre la chaine source (Sepolia) et l'ASC
///         (Creditcoin). Les deux cotes doivent utiliser EXACTEMENT la meme signature pour que
///         le decodage cross-chain fonctionne : le topics[0] d'un log Solidity est
///         keccak256(signature textuelle de l'evenement).
///         EN : Event signatures shared between the source chain (Sepolia) and the ASC
///         (Creditcoin). Both sides must use the EXACT same signature for cross-chain decoding
///         to work: a Solidity log's topics[0] is keccak256(event's text signature).
library EventSignatures {
    // FR : Constante calculee par le compilateur plutot qu'un hash fige en dur -- si la
    // signature de l'evenement change un jour, le hash suit automatiquement, sans faute de
    // frappe silencieuse possible entre les deux chaines.
    // EN : Computed by the compiler rather than a hard-coded hash -- if the event signature
    // ever changes, the hash follows automatically, with no possible silent typo between the
    // two chains.
    bytes32 internal constant MILESTONE_CONFIRMED =
        keccak256("MilestoneConfirmed(uint256,address)");
}
