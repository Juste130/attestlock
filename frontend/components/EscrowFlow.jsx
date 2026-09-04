"use client";

import { useCallback, useEffect, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { useWallet } from "@/lib/WalletContext";
import { CREDITCOIN_TESTNET_NETWORK, SEPOLIA_NETWORK } from "@/lib/networks";
import { ESCROW_ADDRESS, SOURCE_MILESTONE_ADDRESS } from "@/lib/addresses";
import { ESCROW_ABI, SOURCE_MILESTONE_ABI } from "@/lib/abis";
import StateDeposited from "./StateDeposited";
import StateVerifying from "./StateVerifying";
import StateUnlocked from "./StateUnlocked";
import styles from "./EscrowFlow.module.css";

const ESCROW_STATE = { ACTIVE: 0, UNLOCKED: 1, REFUNDED: 2 };
const POLL_INTERVAL_MS = 6000;

/**
 * FR : Orchestre les 3 etats visuels du parcours (depot -> preuve en cours -> debloque) pour un
 * escrow donne. La source de verite reste la chaine (lecture polling de `checkEscrow`) ; le
 * flag local `verifying` sert uniquement a afficher l'etat 2 pendant la fenetre de temps ou la
 * preuve est en transit (entre la confirmation Sepolia et la confirmation de `execute` sur
 * Creditcoin), fenetre que le seul etat on-chain ne peut pas distinguer d'un depot pas encore
 * confirme.
 * EN : Orchestrates the 3 visual states of the flow (deposit -> proof in progress -> unlocked)
 * for a given escrow. The chain remains the source of truth (polling read of `checkEscrow`);
 * the local `verifying` flag only serves to show state 2 during the time window where the
 * proof is in transit (between the Sepolia confirmation and the `execute` confirmation on
 * Creditcoin), a window the on-chain state alone cannot distinguish from a deposit not yet
 * confirmed.
 */
export default function EscrowFlow({ escrowId, onReset }) {
  const { signer, connect, switchNetwork } = useWallet();
  const [agreement, setAgreement] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!ESCROW_ADDRESS) {
      throw new Error(
        "NEXT_PUBLIC_ESCROW_ADDRESS n'est pas configure -- deploie les contrats puis remplis frontend/.env.local / " +
          "NEXT_PUBLIC_ESCROW_ADDRESS is not configured -- deploy the contracts then fill in frontend/.env.local"
      );
    }
    const provider = new JsonRpcProvider(CREDITCOIN_TESTNET_NETWORK.rpcUrls[0]);
    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
    const data = await escrow.checkEscrow(escrowId);
    setAgreement(data);
    return data;
  }, [escrowId]);

  useEffect(() => {
    // FR : Lecture initiale + polling d'un contrat on-chain -- cas d'usage explicitement
    //      documente comme valide par React ("Fetching data"), meme s'il declenche un setState
    //      une fois la promesse resolue plutot que de facon synchrone dans le corps de l'effet.
    // EN : Initial read + polling of an on-chain contract -- a use case React's own docs
    //      explicitly list as valid ("Fetching data"), even though it triggers a setState once
    //      the promise resolves rather than synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch().catch((err) => setError(err.message ?? String(err)));
    const interval = setInterval(() => {
      refetch().catch(() => {
        // FR/EN : erreur de polling silencieuse -- on reessaiera au prochain tick.
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refetch]);

  async function handleConfirmMilestone() {
    setError(null);
    setConfirming(true);
    try {
      const activeSigner = signer ?? (await connect());
      if (!activeSigner) throw new Error("Connecte ton wallet avant de continuer / Connect your wallet first");

      await switchNetwork(SEPOLIA_NETWORK);
      const sourceMilestone = new Contract(SOURCE_MILESTONE_ADDRESS, SOURCE_MILESTONE_ABI, activeSigner);
      const tx = await sourceMilestone.confirmMilestone(escrowId);
      const receipt = await tx.wait();

      setConfirming(false);
      setVerifying(true);

      const response = await fetch("/api/prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrowId, sepoliaTxHash: receipt.hash }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "La vérification de la preuve a échoué / Proof verification failed");
      }

      await refetch();
    } catch (err) {
      setError(err.shortMessage ?? err.message ?? String(err));
    } finally {
      setConfirming(false);
      setVerifying(false);
    }
  }

  if (!agreement) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <span className={styles.escrowLabel}>Chargement de l&apos;escrow #{escrowId}...</span>
          <button type="button" className={styles.resetLink} onClick={onReset}>
            Suivre un autre escrow
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  }

  const state = Number(agreement.state);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.escrowLabel}>Escrow #{escrowId}</span>
        <button type="button" className={styles.resetLink} onClick={onReset}>
          Suivre un autre escrow
        </button>
      </div>

      {state === ESCROW_STATE.UNLOCKED && (
        <div key="unlocked">
          <StateUnlocked agreement={agreement} />
        </div>
      )}

      {state === ESCROW_STATE.REFUNDED && (
        <div key="refunded" className={styles.stepCard} data-accent="neutral">
          <h3 className={styles.stepTitle}>Remboursé</h3>
          <p className={styles.stepBody}>
            L&apos;échéance est passée sans confirmation du jalon : le client a récupéré ses fonds.
          </p>
        </div>
      )}

      {state === ESCROW_STATE.ACTIVE && verifying && (
        <div key="verifying">
          <StateVerifying />
        </div>
      )}

      {state === ESCROW_STATE.ACTIVE && !verifying && (
        <div key="deposited">
          <StateDeposited
            agreement={agreement}
            onConfirmMilestone={handleConfirmMilestone}
            confirming={confirming}
            canConfirm={!verifying}
          />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
