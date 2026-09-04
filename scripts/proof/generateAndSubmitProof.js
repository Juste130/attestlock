import { ethers } from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";
import { requireEnv } from "../utils/env.js";
import { getContract } from "../utils/contracts.js";

// FR : Usage : node proof/generateAndSubmitProof.js <sepoliaTxHash>
// EN : Usage : node proof/generateAndSubmitProof.js <sepoliaTxHash>
const sepoliaTxHash = process.argv[2];
if (!sepoliaTxHash) {
  console.error("Usage: node proof/generateAndSubmitProof.js <sepoliaTxHash>");
  process.exit(1);
}

// FR : Doit correspondre a l'ordre de l'enum EscrowAction dans ASCEscrowVerifier.sol
//      (MilestoneConfirmed = 0). Un seul type d'action existe pour l'instant.
// EN : Must match the EscrowAction enum order in ASCEscrowVerifier.sol
//      (MilestoneConfirmed = 0). Only one action type exists for now.
const ACTION_MILESTONE_CONFIRMED = 0;

/**
 * FR : Coeur de l'integration Attestcoin. Ce script fait le pont entre la confirmation signee
 * par le client sur Sepolia et son effet sur Creditcoin :
 *   1) attend que le bloc contenant la transaction Sepolia soit atteste par le reseau
 *      d'attestors Attestcoin (etape "preuve en cours de verification" cote frontend) ;
 *   2) recupere la preuve Merkle + continuite aupres du service de preuve hebergee ;
 *   3) soumet cette preuve a NOTRE contrat ASCEscrowVerifier.execute(...), qui la fait
 *      verifier par le precompile Block Prover puis debloque les fonds si tout est valide.
 *
 * Important : on n'appelle PAS `PrecompileBlockProver.verifySingle` du SDK ici -- cet helper
 * ne fait que verifier une preuve en lecture seule, sans declencher de logique metier. Pour
 * declencher le deblocage des fonds, il faut appeler la fonction `execute` de NOTRE PROPRE ASC,
 * qui elle-meme appelle le precompile puis notre logique.
 *
 * EN : Core of the Attestcoin integration. This script bridges the client's signed confirmation
 * on Sepolia and its effect on Creditcoin:
 *   1) waits for the block containing the Sepolia transaction to be attested by the Attestcoin
 *      attestor network (the "proof being verified" state on the frontend) ;
 *   2) fetches the Merkle + continuity proof from the hosted proof service ;
 *   3) submits that proof to OUR ASCEscrowVerifier.execute(...) contract, which has it
 *      verified by the Block Prover precompile and then releases funds if everything checks out.
 *
 * Important: we do NOT call the SDK's `PrecompileBlockProver.verifySingle` here -- that helper
 * only performs a read-only proof check, without triggering any business logic. To actually
 * release funds, we must call OUR OWN ASC's `execute` function, which itself calls the
 * precompile and then our logic.
 */
async function main() {
  const {
    SEPOLIA_RPC_URL,
    CREDITCOIN_RPC_URL,
    CREDITCOIN_PROVER_URL,
    SEPOLIA_CHAIN_KEY,
    DEPLOYER_PRIVATE_KEY,
    ASC_ESCROW_VERIFIER_ADDRESS,
  } = requireEnv(
    "SEPOLIA_RPC_URL",
    "CREDITCOIN_RPC_URL",
    "CREDITCOIN_PROVER_URL",
    "SEPOLIA_CHAIN_KEY",
    "DEPLOYER_PRIVATE_KEY",
    "ASC_ESCROW_VERIFIER_ADDRESS"
  );

  const chainKey = Number(SEPOLIA_CHAIN_KEY);
  const sourceProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const creditcoinProvider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
  // FR : `execute` est permissionless par design (n'importe qui peut relayer une preuve
  //      valide) -- on reutilise la cle du deployeur par simplicite pour ce MVP.
  // EN : `execute` is permissionless by design (anyone can relay a valid proof) -- we reuse
  //      the deployer key for simplicity in this MVP.
  const relayer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, creditcoinProvider);

  const sourceTx = await sourceProvider.getTransaction(sepoliaTxHash);
  if (!sourceTx || sourceTx.blockNumber === null) {
    throw new Error("Transaction Sepolia introuvable ou pas encore minee / not found or not yet mined");
  }

  console.log(`Attente de l'attestation du bloc ${sourceTx.blockNumber} / Waiting for block ${sourceTx.blockNumber} to be attested...`);
  const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
  void chainInfoProvider; // FR/EN : reserve pour une validation future (liste des chaines supportees).

  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, CREDITCOIN_PROVER_URL);
  await proofBuilder.waitUntilHeightAttested(chainKey, sourceTx.blockNumber);
  console.log("Bloc atteste / Block attested.");

  const result = await proofBuilder.getProof(sepoliaTxHash);
  if (!result.success || !result.data) {
    throw new Error(`Generation de preuve echouee / Proof generation failed: ${result.error}`);
  }
  const { headerNumber, txBytes, merkleProof, continuityProof } = result.data;

  const ascVerifier = getContract("ASCEscrowVerifier", ASC_ESCROW_VERIFIER_ADDRESS, relayer);

  console.log("Soumission de la preuve a ASCEscrowVerifier.execute(...) / Submitting proof...");
  const tx = await ascVerifier.execute(
    ACTION_MILESTONE_CONFIRMED,
    chainKey,
    headerNumber,
    txBytes,
    merkleProof.root,
    merkleProof.siblings,
    continuityProof.lowerEndpointDigest,
    continuityProof.roots
  );
  const receipt = await tx.wait();

  const unlockedEvent = receipt.logs
    .map((log) => {
      try {
        return ascVerifier.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "MilestoneVerified");

  console.log(`Preuve verifiee, fonds debloques / Proof verified, funds released (tx: ${receipt.hash})`);
  if (unlockedEvent) {
    console.log(`  escrowId=${unlockedEvent.args.escrowId} confirmedBy=${unlockedEvent.args.confirmedBy}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
