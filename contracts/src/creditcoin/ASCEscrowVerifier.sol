// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {ASCBase} from "@gluwa/asc-contracts/contracts/readability/ASCBase.sol";
import {EventSignatures} from "../common/EventSignatures.sol";
import {Escrow} from "./Escrow.sol";

/// @title ASCEscrowVerifier
/// @notice FR : L'Attestcoin Smart Contract (ASC) d'AttestLock, deploye sur Creditcoin. Il
///         n'effectue AUCUNE logique de garde de fonds lui-meme : son unique responsabilite
///         est de verifier, via le precompile Block Prover natif (`0x0FD2`, herite par
///         `ASCBase`), qu'une transaction `confirmMilestone(...)` a bien ete incluse et a
///         reussi sur Ethereum Sepolia -- puis de deleguer le deblocage des fonds au contrat
///         de logique metier separe, `Escrow.sol`. C'est le pattern "ASC separe" documente par
///         Attestcoin : verification cryptographique d'un cote, logique metier de l'autre.
///
///         EN : AttestLock's Attestcoin Smart Contract (ASC), deployed on Creditcoin. It
///         performs NO fund-custody logic itself: its sole responsibility is to verify,
///         through the native Block Prover precompile (`0x0FD2`, inherited via `ASCBase`),
///         that a `confirmMilestone(...)` transaction was truly included and succeeded on
///         Ethereum Sepolia -- then to delegate fund release to the separate business-logic
///         contract, `Escrow.sol`. This is Attestcoin's documented "separate ASC" pattern:
///         cryptographic verification on one side, business logic on the other.
contract ASCEscrowVerifier is Ownable, ASCBase {
    /// @dev FR : Une seule action geree pour l'instant. On garde neanmoins le discriminant
    ///      `action` du pattern ASCBase (plutot qu'un contrat a fonction unique) pour rester
    ///      extensible si AttestLock gere un jour plusieurs types de jalons -- sans that
    ///      complexifier le cas actuel.
    ///      EN : Only one action is handled for now. We still keep ASCBase's `action`
    ///      discriminator (rather than a single-purpose contract) to stay extensible if
    ///      AttestLock ever handles several kinds of milestones -- without complicating the
    ///      current case.
    enum EscrowAction {
        MilestoneConfirmed // 0
    }

    error UnknownAction(uint8 action);

    /// @dev FR : Reference immuable vers le contrat de logique metier -- fixee a la construction,
    ///      ne peut jamais etre detournee vers un autre Escrow apres coup.
    ///      EN : Immutable reference to the business-logic contract -- fixed at construction,
    ///      can never be redirected to a different Escrow afterwards.
    Escrow public immutable ESCROW;

    /// @dev FR : Adresse du contrat SourceMilestone.sol deploye sur Sepolia. Seuls les
    ///      evenements emis par CETTE adresse exacte sont acceptes : sans ce controle,
    ///      n'importe qui pourrait deployer un contrat quelconque sur Sepolia et forger un
    ///      evenement MilestoneConfirmed pour un escrowId qui ne lui appartient pas.
    ///      EN : Address of SourceMilestone.sol deployed on Sepolia. Only events emitted by
    ///      THIS exact address are accepted: without this check, anyone could deploy an
    ///      arbitrary contract on Sepolia and forge a MilestoneConfirmed event for an escrowId
    ///      that isn't theirs.
    address public sourceMilestoneContract;

    event SourceMilestoneContractRegistered(address indexed sourceMilestoneContract);
    event MilestoneVerified(uint256 indexed escrowId, address indexed confirmedBy);

    constructor(address _escrow) Ownable(msg.sender) {
        require(_escrow != address(0), "Escrow cannot be the zero address");
        ESCROW = Escrow(_escrow);
    }

    /// @notice FR : A appeler une seule fois juste apres le deploiement de SourceMilestone.sol
    ///         sur Sepolia, avec son adresse. Sans cet enregistrement, `_processAndEmitEvent`
    ///         rejette systematiquement toute preuve (voir `_decodeMilestoneLog`).
    ///         EN : Call once right after deploying SourceMilestone.sol on Sepolia, with its
    ///         address. Without this registration, `_processAndEmitEvent` systematically
    ///         rejects every proof (see `_decodeMilestoneLog`).
    function registerSourceMilestoneContract(address _sourceMilestoneContract) external onlyOwner {
        require(_sourceMilestoneContract != address(0), "Source contract cannot be the zero address");
        sourceMilestoneContract = _sourceMilestoneContract;
        emit SourceMilestoneContractRegistered(_sourceMilestoneContract);
    }

    /// @notice FR : Hook appele par `ASCBase.execute(...)` UNIQUEMENT apres que le precompile
    ///         Block Prover a verifie la preuve Merkle + continuite ET que `ASCBase` a confirme
    ///         que cette requete n'a jamais ete traitee (anti-rejeu, via `processedQueries`). A
    ///         ce stade, `encodedTransaction` contient les octets *authentiques* de la
    ///         transaction Sepolia : on peut leur faire confiance.
    ///         EN : Hook called by `ASCBase.execute(...)` ONLY after the Block Prover precompile
    ///         has verified the Merkle + continuity proof AND `ASCBase` has confirmed this
    ///         query was never processed before (replay protection, via `processedQueries`). At
    ///         this point `encodedTransaction` holds the *authentic* Sepolia transaction bytes:
    ///         they can be trusted.
    function _processAndEmitEvent(
        uint8 action,
        bytes32,
        bytes memory encodedTransaction
    ) internal override {
        if (action == uint8(EscrowAction.MilestoneConfirmed)) {
            _verifyAndReleaseFunds(encodedTransaction);
        } else {
            revert UnknownAction(action);
        }
    }

    function _verifyAndReleaseFunds(bytes memory encodedTransaction) internal {
        EvmV1Decoder.LogEntry[] memory logs = _extractMilestoneLogs(encodedTransaction);
        (uint256 escrowId, address confirmedBy) = _decodeMilestoneLog(logs[0]);

        emit MilestoneVerified(escrowId, confirmedBy);

        ESCROW.releaseFunds(escrowId, confirmedBy);
    }

    /// @dev FR : Le precompile prouve uniquement que "cette transaction est bien incluse dans
    ///      un bloc" -- pas qu'elle a reussi. Il faut donc explicitement verifier
    ///      `receiptStatus == 1` avant de faire confiance a ses logs : une transaction Sepolia
    ///      qui revert peut quand meme etre minee, incluse dans un bloc, et donc prouvable.
    ///      EN : The precompile only proves "this transaction is truly included in a block" --
    ///      not that it succeeded. `receiptStatus == 1` must be checked explicitly before
    ///      trusting its logs: a reverted Sepolia transaction can still be mined, included in a
    ///      block, and therefore provable.
    function _extractMilestoneLogs(bytes memory encodedTransaction)
        internal
        pure
        returns (EvmV1Decoder.LogEntry[] memory)
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "Unsupported transaction type");

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "Source transaction did not succeed");

        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, EventSignatures.MILESTONE_CONFIRMED);
        require(logs.length > 0, "No MilestoneConfirmed event found in proved transaction");

        return logs;
    }

    /// @dev FR : Decode topics[1] (escrowId, uint256 indexed) et topics[2] (confirmedBy,
    ///      address indexed). Voir la note de securite sur `sourceMilestoneContract` ci-dessus.
    ///      EN : Decodes topics[1] (escrowId, indexed uint256) and topics[2] (confirmedBy,
    ///      indexed address). See the security note on `sourceMilestoneContract` above.
    function _decodeMilestoneLog(EvmV1Decoder.LogEntry memory log)
        internal
        view
        returns (uint256 escrowId, address confirmedBy)
    {
        require(sourceMilestoneContract != address(0), "Source milestone contract not registered");
        require(log.address_ == sourceMilestoneContract, "Event not emitted by the registered source contract");
        require(log.topics.length == 3, "Invalid MilestoneConfirmed topics");
        require(log.topics[0] == EventSignatures.MILESTONE_CONFIRMED, "Not a MilestoneConfirmed event");

        escrowId = uint256(log.topics[1]);
        confirmedBy = address(uint160(uint256(log.topics[2])));
    }
}
