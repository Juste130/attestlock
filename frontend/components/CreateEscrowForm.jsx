"use client";

import { useState } from "react";
import { Contract, parseEther } from "ethers";
import { useWallet } from "@/lib/WalletContext";
import { CREDITCOIN_TESTNET_NETWORK } from "@/lib/networks";
import { ESCROW_ADDRESS } from "@/lib/addresses";
import { ESCROW_ABI } from "@/lib/abis";
import styles from "./CreateEscrowForm.module.css";

/**
 * FR : Formulaire joue par le CLIENT : cree un accord d'escrow pour un freelance donne, puis
 * verrouille immediatement le montant convenu. Les deux transactions (creation + depot) sont
 * enchainees ici pour que l'utilisateur n'ait qu'un seul parcours a suivre, meme si ce sont
 * deux appels de contrat distincts cote Solidity (voir Escrow.sol).
 * EN : Form played by the CLIENT: creates an escrow agreement for a given freelancer, then
 * immediately locks the agreed amount. Both transactions (creation + deposit) are chained
 * here so the user only has one flow to follow, even though they are two separate contract
 * calls on the Solidity side (see Escrow.sol).
 */
export default function CreateEscrowForm({ onCreated, onTrack }) {
  const { signer, connect, switchNetwork } = useWallet();

  const [freelancer, setFreelancer] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [amount, setAmount] = useState("0.01");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [trackId, setTrackId] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!ESCROW_ADDRESS) {
        throw new Error(
          "NEXT_PUBLIC_ESCROW_ADDRESS n'est pas configure -- deploie les contrats puis remplis frontend/.env.local / " +
            "NEXT_PUBLIC_ESCROW_ADDRESS is not configured -- deploy the contracts then fill in frontend/.env.local"
        );
      }
      const activeSigner = signer ?? (await connect());
      if (!activeSigner) {
        throw new Error("Connecte ton wallet avant de continuer / Connect your wallet first");
      }
      await switchNetwork(CREDITCOIN_TESTNET_NETWORK);

      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, activeSigner);

      const createTx = await escrow.createEscrow(freelancer, Number(durationDays) * 24 * 60 * 60);
      const createReceipt = await createTx.wait();
      const createdEvent = createReceipt.logs
        .map((log) => {
          try {
            return escrow.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event_) => event_?.name === "EscrowCreated");
      const escrowId = createdEvent.args.id;

      const depositTx = await escrow.deposit(escrowId, { value: parseEther(amount) });
      await depositTx.wait();

      onCreated(escrowId.toString());
    } catch (err) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleTrack(event) {
    event.preventDefault();
    if (trackId.trim()) onTrack(trackId.trim());
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Créer un escrow</h2>
      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="freelancer">
            Adresse du freelance
          </label>
          <input
            id="freelancer"
            className={styles.input}
            value={freelancer}
            onChange={(event) => setFreelancer(event.target.value)}
            placeholder="0x..."
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="duration">
            Délai avant expiration (jours)
          </label>
          <input
            id="duration"
            type="number"
            min="1"
            className={styles.input}
            value={durationDays}
            onChange={(event) => setDurationDays(event.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="amount">
            Montant à verrouiller (tCTC)
          </label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Transaction en cours..." : "Créer et financer l'escrow"}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>

      <div className={styles.divider}>ou</div>

      <form onSubmit={handleTrack} className={styles.trackRow}>
        <input
          className={styles.input}
          value={trackId}
          onChange={(event) => setTrackId(event.target.value)}
          placeholder="Identifiant d'un escrow existant"
        />
        <button type="submit" className={styles.trackButton}>
          Suivre
        </button>
      </form>
    </div>
  );
}
