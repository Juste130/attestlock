// FR : Fragments d'ABI ecrits a la main (format "human-readable" d'ethers v6), plutot que lus
//      depuis contracts/out/*.json comme le fait scripts/utils/contracts.js. Raison : ce
//      dossier n'existe pas forcement dans le bundle d'une fonction serverless deployee (Vercel
//      ne trace pas ces fichiers par defaut) -- le frontend doit rester deployable sans
//      dependre du systeme de fichiers du monorepo. A garder synchronise avec les contrats
//      Solidity dans contracts/src/.
// EN : Hand-written ABI fragments (ethers v6 "human-readable" format), rather than read from
//      contracts/out/*.json the way scripts/utils/contracts.js does. Reason: that folder isn't
//      guaranteed to exist in a deployed serverless function's bundle (Vercel doesn't trace
//      those files by default) -- the frontend must stay deployable without depending on the
//      monorepo's filesystem. Keep in sync with the Solidity contracts in contracts/src/.

export const ESCROW_ABI = [
  "function createEscrow(address freelancer, uint256 duration) returns (uint256 id)",
  "function deposit(uint256 escrowId) payable",
  "function checkEscrow(uint256 escrowId) view returns (tuple(address client, address freelancer, uint256 amount, uint256 deadline, uint8 state))",
  "event EscrowCreated(uint256 indexed id, address indexed client, address indexed freelancer, uint256 deadline)",
  "event Deposited(uint256 indexed id, uint256 amount)",
  "event FundsUnlocked(uint256 indexed id, address indexed freelancer, uint256 amount)",
  "event Refunded(uint256 indexed id, address indexed client, uint256 amount)",
];

export const SOURCE_MILESTONE_ABI = [
  "function confirmMilestone(uint256 escrowId)",
  "event MilestoneConfirmed(uint256 indexed escrowId, address indexed confirmedBy)",
];

// FR : `execute` vient de ASCBase (heritee) -- voir @gluwa/asc-contracts/contracts/readability/ASCBase.sol.
// EN : `execute` comes from ASCBase (inherited) -- see @gluwa/asc-contracts/contracts/readability/ASCBase.sol.
export const ASC_ESCROW_VERIFIER_ABI = [
  "function execute(uint8 action, uint64 chainKey, uint64 blockHeight, bytes encodedTransaction, bytes32 merkleRoot, tuple(bytes32 hash, bool isLeft)[] siblings, bytes32 lowerEndpointDigest, bytes32[] continuityRoots) returns (bool success)",
  "event MilestoneVerified(uint256 indexed escrowId, address indexed confirmedBy)",
];

// FR : Doit correspondre a l'ordre de l'enum EscrowAction dans ASCEscrowVerifier.sol.
// EN : Must match the EscrowAction enum order in ASCEscrowVerifier.sol.
export const ACTION_MILESTONE_CONFIRMED = 0;

export const ESCROW_STATE_LABELS = ["Active", "Unlocked", "Refunded"];
