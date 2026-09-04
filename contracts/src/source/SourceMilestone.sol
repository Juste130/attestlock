// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title SourceMilestone
/// @notice FR : Contrat deploye sur la chaine SOURCE (Ethereum Sepolia). Il ne detient jamais
///         de fonds : son unique role est de laisser le client signer, depuis son propre
///         wallet Sepolia, la confirmation qu'un jalon est atteint pour un escrow donne. C'est
///         cette transaction -- et l'evenement qu'elle emet -- que le protocole Attestcoin va
///         prouver cryptographiquement a l'ASC sur Creditcoin (readability). On garde ce
///         contrat volontairement minimal (aucune logique metier, aucun transfert de valeur) :
///         la documentation Attestcoin recommande explicitement de garder la chaine source la
///         plus fine possible, la complexite doit vivre cote Creditcoin ou le gas est moins cher.
///
///         EN : Contract deployed on the SOURCE chain (Ethereum Sepolia). It never holds
///         funds: its only job is to let the client sign, from their own Sepolia wallet, the
///         confirmation that a milestone was reached for a given escrow. It is this
///         transaction -- and the event it emits -- that the Attestcoin protocol will
///         cryptographically prove to the ASC on Creditcoin (readability). This contract is
///         intentionally minimal (no business logic, no value transfer): Attestcoin docs
///         explicitly recommend keeping the source chain as thin as possible, complexity
///         should live on Creditcoin where gas is cheaper.
contract SourceMilestone {
    /// @dev FR : `escrowId` doit correspondre a l'identifiant de l'accord enregistre dans
    ///      Escrow.sol sur Creditcoin. La signature de cet evenement -- MilestoneConfirmed(uint256,address)
    ///      -- doit rester identique a `EventSignatures.MILESTONE_CONFIRMED` cote Creditcoin,
    ///      sinon l'ASC ne retrouvera jamais ce log lors du decodage de la preuve.
    ///      EN : `escrowId` must match the agreement id registered in Escrow.sol on
    ///      Creditcoin. This event's signature -- MilestoneConfirmed(uint256,address) -- must
    ///      stay identical to `EventSignatures.MILESTONE_CONFIRMED` on the Creditcoin side,
    ///      otherwise the ASC will never find this log when decoding the proof.
    event MilestoneConfirmed(uint256 indexed escrowId, address indexed confirmedBy);

    /// @notice FR : Le client appelle cette fonction pour attester qu'un jalon (livraison,
    ///         paiement, validation) est atteint pour l'escrow `escrowId`. C'est le signataire
    ///         de CETTE transaction (msg.sender) qui fait foi : l'ASC verifiera plus tard, cote
    ///         Creditcoin, que `confirmedBy` correspond bien au client enregistre pour cet escrow
    ///         avant de debloquer les fonds.
    ///         EN : The client calls this function to attest that a milestone (delivery,
    ///         payment, validation) is reached for escrow `escrowId`. The signer of THIS
    ///         transaction (msg.sender) is what matters: the ASC will later check, on the
    ///         Creditcoin side, that `confirmedBy` matches the client registered for that
    ///         escrow before releasing funds.
    /// @param escrowId FR : identifiant de l'escrow correspondant sur Creditcoin.
    ///                 EN : id of the matching escrow on Creditcoin.
    function confirmMilestone(uint256 escrowId) external {
        emit MilestoneConfirmed(escrowId, msg.sender);
    }
}
