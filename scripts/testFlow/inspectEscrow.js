import { ethers } from "ethers";
import { requireEnv } from "../utils/env.js";
import { getContract } from "../utils/contracts.js";

// FR : Usage : node testFlow/inspectEscrow.js <escrowId>
// EN : Usage : node testFlow/inspectEscrow.js <escrowId>
const escrowId = process.argv[2];
if (!escrowId) {
  console.error("Usage: node testFlow/inspectEscrow.js <escrowId>");
  process.exit(1);
}

const STATE_NAMES = ["Active", "Unlocked", "Refunded"];

/** FR : Lecture seule -- utile pour verifier l'etat d'un escrow entre deux etapes manuelles.
 * EN : Read-only -- useful to check an escrow's state between two manual steps. */
async function main() {
  const { CREDITCOIN_RPC_URL, ESCROW_ADDRESS } = requireEnv("CREDITCOIN_RPC_URL", "ESCROW_ADDRESS");

  const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
  const escrow = getContract("Escrow", ESCROW_ADDRESS, provider);

  const agreement = await escrow.checkEscrow(escrowId);

  console.log(`Escrow #${escrowId}`);
  console.log(`  client:      ${agreement.client}`);
  console.log(`  freelancer:  ${agreement.freelancer}`);
  console.log(`  amount:      ${ethers.formatEther(agreement.amount)} CTC`);
  console.log(`  deadline:    ${new Date(Number(agreement.deadline) * 1000).toISOString()}`);
  console.log(`  state:       ${STATE_NAMES[Number(agreement.state)]}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
