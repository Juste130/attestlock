import { ethers } from "ethers";
import { requireEnv } from "../utils/env.js";
import { getContract } from "../utils/contracts.js";

// FR : Usage : node testFlow/createAndFundEscrow.js [montantEnEth] [dureeEnSecondes]
// EN : Usage : node testFlow/createAndFundEscrow.js [amountInEth] [durationInSeconds]
const depositAmountEth = process.argv[2] ?? "0.01";
const durationSeconds = Number(process.argv[3] ?? 24 * 60 * 60); // 1 jour / 1 day par defaut

/**
 * FR : Script de test manuel (etape 7) : joue le role du CLIENT sur Creditcoin, sans passer
 * par le frontend, pour verifier qu'Escrow.sol fonctionne seul sur testnet avant d'assembler
 * le reste du systeme.
 * EN : Manual test script (step 7): plays the CLIENT's role on Creditcoin, without going
 * through the frontend, to verify Escrow.sol works on its own on testnet before assembling the
 * rest of the system.
 */
async function main() {
  const { CREDITCOIN_RPC_URL, CLIENT_PRIVATE_KEY, FREELANCER_ADDRESS, ESCROW_ADDRESS } = requireEnv(
    "CREDITCOIN_RPC_URL",
    "CLIENT_PRIVATE_KEY",
    "FREELANCER_ADDRESS",
    "ESCROW_ADDRESS"
  );

  const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
  const client = new ethers.Wallet(CLIENT_PRIVATE_KEY, provider);
  const escrow = getContract("Escrow", ESCROW_ADDRESS, client);

  const createTx = await escrow.createEscrow(FREELANCER_ADDRESS, durationSeconds);
  const createReceipt = await createTx.wait();

  const createdEvent = createReceipt.logs
    .map((log) => {
      try {
        return escrow.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "EscrowCreated");
  const escrowId = createdEvent.args.id;
  console.log(`Escrow #${escrowId} cree / created (client=${client.address}, freelancer=${FREELANCER_ADDRESS})`);

  const depositTx = await escrow.deposit(escrowId, { value: ethers.parseEther(depositAmountEth) });
  await depositTx.wait();
  console.log(`${depositAmountEth} CTC deposes sur l'escrow #${escrowId} / deposited on escrow #${escrowId}`);

  console.log("\nGarde cet id pour la suite / Keep this id for the next steps:");
  console.log(`ESCROW_ID=${escrowId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
