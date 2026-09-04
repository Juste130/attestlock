import { ethers } from "ethers";
import { requireEnv } from "../utils/env.js";
import { getContractFactory } from "../utils/contracts.js";

/**
 * FR : Deploie SourceMilestone.sol sur Ethereum Sepolia. Contrat volontairement independant et
 * sans aucune dependance a Creditcoin : il peut etre deploye avant, apres, ou en parallele de
 * deployCreditcoinContracts.js.
 * EN : Deploys SourceMilestone.sol on Ethereum Sepolia. Intentionally independent contract with
 * no dependency on Creditcoin: it can be deployed before, after, or in parallel with
 * deployCreditcoinContracts.js.
 */
async function main() {
  const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = requireEnv(
    "SEPOLIA_RPC_URL",
    "DEPLOYER_PRIVATE_KEY"
  );

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  console.log(`Deploiement depuis / Deploying from: ${deployer.address}`);

  const factory = getContractFactory("SourceMilestone", deployer);
  const sourceMilestone = await factory.deploy();
  await sourceMilestone.waitForDeployment();
  const address = await sourceMilestone.getAddress();

  console.log(`SourceMilestone.sol deploye a / deployed at: ${address}`);
  console.log("\nAjoute cette ligne a ton .env / Add this line to your .env :");
  console.log(`SOURCE_MILESTONE_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
