import { ethers } from "ethers";
import { chainInfo, proofProvider } from "@gluwa/usc-sdk";
import { ASC_ESCROW_VERIFIER_ADDRESS } from "@/lib/addresses";
import { ASC_ESCROW_VERIFIER_ABI, ACTION_MILESTONE_CONFIRMED } from "@/lib/abis";
import { SEPOLIA_CHAIN_KEY } from "@/lib/networks";

/**
 * FR : Route serveur (jamais executee dans le navigateur) qui fait le pont Attestcoin :
 * attend l'attestation du bloc Sepolia contenant `sepoliaTxHash`, recupere la preuve
 * Merkle + continuite, puis l'envoie a ASCEscrowVerifier.execute(...). Cote client
 * (components/EscrowFlow.jsx), c'est cet appel qui separe visuellement l'etat 2 ("preuve en
 * cours de verification") de l'etat 3 ("fonds debloques").
 *
 * Vit cote serveur plutot que dans le navigateur du client pour deux raisons : (1) la cle qui
 * paie le gas de soumission (`RELAYER_PRIVATE_KEY`) ne doit jamais atteindre le navigateur ;
 * (2) l'attente d'attestation peut prendre du temps, une route serveur peut la mener a bien
 * meme si l'utilisateur ferme son onglet.
 *
 * EN : Server route (never runs in the browser) that bridges Attestcoin: waits for the
 * attestation of the Sepolia block containing `sepoliaTxHash`, fetches the Merkle + continuity
 * proof, then sends it to ASCEscrowVerifier.execute(...). On the client side
 * (components/EscrowFlow.jsx), this call is what visually separates state 2 ("proof being
 * verified") from state 3 ("funds released").
 *
 * Lives server-side rather than in the client's browser for two reasons: (1) the key that
 * pays submission gas (`RELAYER_PRIVATE_KEY`) must never reach the browser; (2) waiting for
 * attestation can take a while, a server route can see it through even if the user closes
 * their tab.
 */
export async function POST(request) {
  const { escrowId, sepoliaTxHash } = await request.json();

  if (!escrowId || !sepoliaTxHash) {
    return Response.json({ error: "escrowId et sepoliaTxHash sont requis / are required" }, { status: 400 });
  }

  const { NEXT_PUBLIC_SEPOLIA_RPC_URL, NEXT_PUBLIC_CREDITCOIN_RPC_URL, CREDITCOIN_PROVER_URL, RELAYER_PRIVATE_KEY } =
    process.env;

  if (!NEXT_PUBLIC_SEPOLIA_RPC_URL || !NEXT_PUBLIC_CREDITCOIN_RPC_URL || !CREDITCOIN_PROVER_URL || !RELAYER_PRIVATE_KEY) {
    return Response.json(
      { error: "Configuration serveur incomplete (voir .env.local.example) / Incomplete server configuration" },
      { status: 500 }
    );
  }

  try {
    const sourceProvider = new ethers.JsonRpcProvider(NEXT_PUBLIC_SEPOLIA_RPC_URL);
    const creditcoinProvider = new ethers.JsonRpcProvider(NEXT_PUBLIC_CREDITCOIN_RPC_URL);
    const relayer = new ethers.Wallet(RELAYER_PRIVATE_KEY, creditcoinProvider);

    const sourceTx = await sourceProvider.getTransaction(sepoliaTxHash);
    if (!sourceTx || sourceTx.blockNumber === null) {
      throw new Error("Transaction Sepolia introuvable ou pas encore minee / not found or not yet mined");
    }

    void new chainInfo.PrecompileChainInfoProvider(creditcoinProvider); // reserve pour validation future / reserved for future validation

    const proofBuilder = new proofProvider.service.ProofBuilder(SEPOLIA_CHAIN_KEY, CREDITCOIN_PROVER_URL);
    await proofBuilder.waitUntilHeightAttested(SEPOLIA_CHAIN_KEY, sourceTx.blockNumber);

    const result = await proofBuilder.getProof(sepoliaTxHash);
    if (!result.success || !result.data) {
      throw new Error(`Generation de preuve echouee / Proof generation failed: ${result.error}`);
    }
    const { headerNumber, txBytes, merkleProof, continuityProof } = result.data;

    const ascVerifier = new ethers.Contract(ASC_ESCROW_VERIFIER_ADDRESS, ASC_ESCROW_VERIFIER_ABI, relayer);
    const tx = await ascVerifier.execute(
      ACTION_MILESTONE_CONFIRMED,
      SEPOLIA_CHAIN_KEY,
      headerNumber,
      txBytes,
      merkleProof.root,
      merkleProof.siblings,
      continuityProof.lowerEndpointDigest,
      continuityProof.roots
    );
    const receipt = await tx.wait();

    return Response.json({ success: true, creditcoinTxHash: receipt.hash });
  } catch (error) {
    return Response.json({ error: error.shortMessage ?? error.message ?? String(error) }, { status: 502 });
  }
}
