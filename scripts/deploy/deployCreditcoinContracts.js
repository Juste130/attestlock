import { ethers } from "ethers";
import { requireEnv } from "../utils/env.js";
import { getContractFactory, getContract } from "../utils/contracts.js";

/**
 * FR : Deploie Escrow.sol puis ASCEscrowVerifier.sol sur Creditcoin, dans cet ordre precis --
 * l'ASC a besoin de l'adresse d'Escrow des sa construction, alors qu'Escrow n'a pas besoin de
 * connaitre l'ASC avant coup (voir le commentaire sur `registerASCVerifier` dans Escrow.sol).
 * Termine en liant les deux (`registerASCVerifier`) pour que le deploiement produise un systeme
 * immediatement fonctionnel cote Creditcoin.
 *
 * EN : Deploys Escrow.sol then ASCEscrowVerifier.sol on Creditcoin, in that exact order -- the
 * ASC needs Escrow's address at construction time, while Escrow doesn't need to know the ASC's
 * address beforehand (see the `registerASCVerifier` comment in Escrow.sol). Finishes by linking
 * the two (`registerASCVerifier`) so the deployment produces an immediately functional system
 * on the Creditcoin side.
 */
async function main() {
  const { CREDITCOIN_RPC_URL, DEPLOYER_PRIVATE_KEY } = requireEnv(
    "CREDITCOIN_RPC_URL",
    "DEPLOYER_PRIVATE_KEY"
  );

  const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  console.log(`Deploiement depuis / Deploying from: ${deployer.address}`);

  const escrowFactory = getContractFactory("Escrow", deployer);
  const escrow = await escrowFactory.deploy();
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`Escrow.sol deploye a / deployed at: ${escrowAddress}`);

  const ascVerifierFactory = getContractFactory("ASCEscrowVerifier", deployer);
  const ascVerifier = await ascVerifierFactory.deploy(escrowAddress);
  await ascVerifier.waitForDeployment();
  const ascVerifierAddress = await ascVerifier.getAddress();
  console.log(`ASCEscrowVerifier.sol deploye a / deployed at: ${ascVerifierAddress}`);

  const escrowWithSigner = getContract("Escrow", escrowAddress, deployer);
  const registerTx = await escrowWithSigner.registerASCVerifier(ascVerifierAddress);
  await registerTx.wait();
  console.log("Escrow.registerASCVerifier(...) confirme / confirmed.");

  console.log("\nAjoute ces lignes a ton .env / Add these lines to your .env :");
  console.log(`ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`ASC_ESCROW_VERIFIER_ADDRESS=${ascVerifierAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
