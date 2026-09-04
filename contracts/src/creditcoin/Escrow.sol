// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Escrow
/// @notice FR : Contrat de LOGIQUE METIER, deploye sur Creditcoin. Il sequestre les fonds
///         deposes par un client pour un freelance, et ne les debloque que sur appel de
///         l'ASCEscrowVerifier -- jamais directement par un humain. Cette separation (impose
///         par le pattern Attestcoin "ASC separe") garde la logique de garde des fonds isolee
///         de la logique de verification cryptographique cross-chain : plus simple a auditer,
///         et reutilisable avec un autre mecanisme de preuve si besoin un jour.
///
///         Structure directement adaptee de MultiPartyEscrow.sol (registre par id incrementale,
///         enum d'etat, ReentrancyGuard, transferts via call{value:}) mais simplifiee pour un
///         escrow 1 client <-> 1 freelance avec montant libre au moment du depot, plutot qu'un
///         financement participatif a objectif fixe.
///
///         EN : BUSINESS LOGIC contract, deployed on Creditcoin. It escrows funds deposited by
///         a client for a freelancer, and only releases them when called by the
///         ASCEscrowVerifier -- never directly by a human. This separation (mandated by the
///         Attestcoin "separate ASC" pattern) keeps fund-custody logic isolated from
///         cross-chain cryptographic verification logic: simpler to audit, and reusable with a
///         different proof mechanism later if needed.
///
///         Structure directly adapted from MultiPartyEscrow.sol (incrementing id registry,
///         state enum, ReentrancyGuard, call{value:} transfers) but simplified for a 1
///         client <-> 1 freelancer escrow with a free-form amount set at deposit time, rather
///         than goal-based crowdfunding.
contract Escrow is Ownable, ReentrancyGuard {
    enum EscrowState {
        Active,
        Unlocked,
        Refunded
    }

    struct Agreement {
        address client;
        address freelancer;
        uint256 amount;
        uint256 deadline;
        EscrowState state;
    }

    uint256 public escrowCount;
    mapping(uint256 => Agreement) public escrows;

    /// @dev FR : Seule cette adresse (l'ASCEscrowVerifier) peut appeler `releaseFunds` -- elle
    ///      seule a verifie la preuve cryptographique venant de Sepolia avant d'agir.
    ///      EN : Only this address (the ASCEscrowVerifier) may call `releaseFunds` -- it alone
    ///      has verified the cryptographic proof coming from Sepolia before acting.
    address public ascVerifier;

    event EscrowCreated(uint256 indexed id, address indexed client, address indexed freelancer, uint256 deadline);
    event Deposited(uint256 indexed id, uint256 amount);
    event FundsUnlocked(uint256 indexed id, address indexed freelancer, uint256 amount);
    event Refunded(uint256 indexed id, address indexed client, uint256 amount);
    event ASCVerifierRegistered(address indexed ascVerifier);

    modifier onlyASCVerifier() {
        require(msg.sender == ascVerifier, "Only the registered ASC verifier can call this");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /// @notice FR : A appeler une seule fois juste apres le deploiement d'ASCEscrowVerifier.sol,
    ///         avec son adresse. Separee du constructeur pour casser la dependance circulaire :
    ///         l'ASC a besoin de connaitre l'adresse de CET Escrow dans son propre constructeur,
    ///         donc Escrow doit exister avant l'ASC, donc Escrow ne peut pas connaitre l'adresse
    ///         de l'ASC a SA propre construction.
    ///         EN : Call once right after deploying ASCEscrowVerifier.sol, with its address.
    ///         Kept out of the constructor to break the circular dependency: the ASC needs to
    ///         know this Escrow's address in its own constructor, so Escrow must exist before
    ///         the ASC, so Escrow cannot know the ASC's address at its own construction time.
    function registerASCVerifier(address _ascVerifier) external onlyOwner {
        require(_ascVerifier != address(0), "ASC verifier cannot be the zero address");
        ascVerifier = _ascVerifier;
        emit ASCVerifierRegistered(_ascVerifier);
    }

    /// @notice FR : Le client ouvre un accord d'escrow avec un freelance donne. Le montant
    ///         n'est pas fixe ici : il est defini librement au moment du depot (`deposit`),
    ///         car un montant de prestation freelance se negocie hors-chaine avant d'etre
    ///         verrouille, contrairement a un objectif de financement participatif fixe d'avance.
    ///         EN : The client opens an escrow agreement with a given freelancer. The amount is
    ///         not fixed here: it is set freely at deposit time (`deposit`), because a
    ///         freelance engagement amount is negotiated off-chain before being locked, unlike
    ///         a crowdfunding goal fixed in advance.
    function createEscrow(address _freelancer, uint256 _duration) external returns (uint256 id) {
        require(_freelancer != address(0), "Freelancer cannot be the zero address");
        require(_freelancer != msg.sender, "Client and freelancer must be different addresses");
        require(_duration > 0, "Duration must be > 0");

        escrowCount++;
        id = escrowCount;
        uint256 deadline = block.timestamp + _duration;

        escrows[id] = Agreement({
            client: msg.sender,
            freelancer: _freelancer,
            amount: 0,
            deadline: deadline,
            state: EscrowState.Active
        });

        emit EscrowCreated(id, msg.sender, _freelancer, deadline);
    }

    /// @notice FR : Le client verrouille les fonds pour l'escrow `_escrowId`. Un seul depot par
    ///         escrow (pas d'ajouts successifs) : `amount == 0` sert de garde anti-double-depot.
    ///         EN : The client locks funds for escrow `_escrowId`. Single deposit per escrow
    ///         (no successive top-ups): `amount == 0` acts as an anti-double-deposit guard.
    function deposit(uint256 _escrowId) external payable nonReentrant {
        Agreement storage escrow = escrows[_escrowId];
        require(escrow.client == msg.sender, "Only the client of this escrow can deposit");
        require(escrow.state == EscrowState.Active, "Escrow is not active");
        require(escrow.amount == 0, "Escrow already funded");
        require(msg.value > 0, "Deposit must be greater than 0");
        require(block.timestamp < escrow.deadline, "Deadline already passed");

        escrow.amount = msg.value;

        emit Deposited(_escrowId, msg.value);
    }

    /// @notice FR : Jamais appelee directement par un humain. C'est ASCEscrowVerifier.sol qui
    ///         appelle cette fonction, et seulement apres avoir verifie cryptographiquement
    ///         (via le precompile Block Prover 0x0FD2) que le CLIENT enregistre pour cet escrow
    ///         a bien confirme le jalon sur Sepolia. Le controle `confirmedBy == escrow.client`
    ///         est une seconde ligne de defense : meme si l'ASC etait mal configure ou buggue,
    ///         cette fonction refuse de debloquer les fonds vers quiconque d'autre que le vrai
    ///         client n'a signe.
    ///         EN : Never called directly by a human. ASCEscrowVerifier.sol calls this
    ///         function, and only after cryptographically verifying (via the Block Prover
    ///         precompile 0x0FD2) that the CLIENT registered for this escrow did confirm the
    ///         milestone on Sepolia. The `confirmedBy == escrow.client` check is a second line
    ///         of defense: even if the ASC were misconfigured or buggy, this function refuses
    ///         to release funds unless the real client is the one who signed.
    function releaseFunds(uint256 _escrowId, address confirmedBy) external onlyASCVerifier nonReentrant {
        Agreement storage escrow = escrows[_escrowId];
        require(escrow.state == EscrowState.Active, "Escrow is not active");
        require(escrow.amount > 0, "Escrow has no funds to release");
        require(confirmedBy == escrow.client, "Milestone was not confirmed by the registered client");

        escrow.state = EscrowState.Unlocked;
        uint256 amount = escrow.amount;

        (bool success, ) = payable(escrow.freelancer).call{value: amount}("");
        require(success, "Transfer to freelancer failed");

        emit FundsUnlocked(_escrowId, escrow.freelancer, amount);
    }

    /// @notice FR : Filet de securite pour le client : si le jalon n'a jamais ete confirme (ou
    ///         si la preuve cross-chain n'a jamais ete soumise) avant la deadline, le client
    ///         peut recuperer ses fonds lui-meme, sans dependre d'Attestcoin ni du freelance.
    ///         EN : Safety net for the client: if the milestone was never confirmed (or the
    ///         cross-chain proof was never submitted) before the deadline, the client can
    ///         reclaim their funds themselves, without depending on Attestcoin or the freelancer.
    function refund(uint256 _escrowId) external nonReentrant {
        Agreement storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.client, "Only the client can request a refund");
        require(block.timestamp > escrow.deadline, "Deadline has not passed yet");
        require(escrow.state == EscrowState.Active, "Escrow is not active");
        require(escrow.amount > 0, "Nothing to refund");

        escrow.state = EscrowState.Refunded;
        uint256 amount = escrow.amount;

        (bool success, ) = payable(escrow.client).call{value: amount}("");
        require(success, "Refund failed");

        emit Refunded(_escrowId, escrow.client, amount);
    }

    function checkEscrow(uint256 _escrowId) external view returns (Agreement memory) {
        return escrows[_escrowId];
    }
}
