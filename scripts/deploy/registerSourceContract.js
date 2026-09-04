import { ethers } from "ethers";
import { requireEnv } from "../utils/env.js";
import { getContract } from "../utils/contracts.js";

/**
 * FR : Derniere etape du deploiement, a lancer une fois que les DEUX chaines ont leurs
 * contrats en place. Elle relie l'ASC (Creditcoin) au contrat source (Sepolia) : sans cet
 * appel, ASCEscrowVerifier rejette toute preuve ("Source milestone contract not registered"),
 * car il ne saurait pas quelle adresse Sepolia faire confiance.
 * EN : Final deployment step, run once BOTH chains have their contracts in place. It links the
 * ASC (Creditcoin) to the source contract (Sepolia): without this call, ASCEscrowVerifier
 * rejects every proof ("Source milestone contract not registered"), since it would have no
 * Sepolia address to trust.
 */
async function main() {
  const { CREDITCOIN_RPC_URL, DEPLOYER_PRIVATE_KEY, ASC_ESCROW_VERIFIER_ADDRESS, SOURCE_MILESTONE_ADDRESS } =
    requireEnv(
      "CREDITCOIN_RPC_URL",
      "DEPLOYER_PRIVATE_KEY",
      "ASC_ESCROW_VERIFIER_ADDRESS",
      "SOURCE_MILESTONE_ADDRESS"
    );

  const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  const ascVerifier = getContract("ASCEscrowVerifier", ASC_ESCROW_VERIFIER_ADDRESS, deployer);
  const tx = await ascVerifier.registerSourceMilestoneContract(SOURCE_MILESTONE_ADDRESS);
  await tx.wait();

  console.log(
    `ASCEscrowVerifier lie a SourceMilestone / linked to SourceMilestone: ${SOURCE_MILESTONE_ADDRESS}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
