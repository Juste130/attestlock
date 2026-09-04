import { ethers } from "ethers";
import { requireEnv } from "../utils/env.js";
import { getContract } from "../utils/contracts.js";

// FR : Usage : node testFlow/confirmMilestoneOnSepolia.js <escrowId>
// EN : Usage : node testFlow/confirmMilestoneOnSepolia.js <escrowId>
const escrowId = process.argv[2];
if (!escrowId) {
  console.error("Usage: node testFlow/confirmMilestoneOnSepolia.js <escrowId>");
  process.exit(1);
}

/**
 * FR : Joue le role du CLIENT sur Sepolia : signe la confirmation du jalon pour `escrowId`.
 * C'est CETTE transaction que le SDK usc-sdk va ensuite prouver a Creditcoin
 * (proof/generateAndSubmitProof.js) -- garde bien le hash affiche.
 * EN : Plays the CLIENT's role on Sepolia: signs the milestone confirmation for `escrowId`.
 * This is the transaction that usc-sdk will then prove to Creditcoin
 * (proof/generateAndSubmitProof.js) -- keep the printed hash.
 */
async function main() {
  const { SEPOLIA_RPC_URL, CLIENT_PRIVATE_KEY, SOURCE_MILESTONE_ADDRESS } = requireEnv(
    "SEPOLIA_RPC_URL",
    "CLIENT_PRIVATE_KEY",
    "SOURCE_MILESTONE_ADDRESS"
  );

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const client = new ethers.Wallet(CLIENT_PRIVATE_KEY, provider);
  const sourceMilestone = getContract("SourceMilestone", SOURCE_MILESTONE_ADDRESS, client);

  const tx = await sourceMilestone.confirmMilestone(escrowId);
  const receipt = await tx.wait();

  console.log(`Jalon confirme sur Sepolia / Milestone confirmed on Sepolia (escrow #${escrowId})`);
  console.log("\nGarde ce hash pour la suite / Keep this hash for the next step:");
  console.log(`SEPOLIA_TX_HASH=${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
