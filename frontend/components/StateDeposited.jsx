import { formatEther } from "ethers";
import styles from "./EscrowFlow.module.css";

/** FR : Etat visuel 1 -- le depot est verrouille, en attente que le client confirme le jalon
 *  sur Sepolia. EN : Visual state 1 -- the deposit is locked, waiting for the client to confirm
 *  the milestone on Sepolia. */
export default function StateDeposited({ agreement, onConfirmMilestone, confirming, canConfirm }) {
  return (
    <div className={styles.stepCard} data-accent="neutral">
      <h3 className={styles.stepTitle}>Dépôt verrouillé</h3>
      <p className={styles.stepBody}>
        Les fonds sont en séquestre sur Creditcoin. Le client doit confirmer le jalon sur Ethereum
        Sepolia pour déclencher le déblocage.
      </p>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Montant</span>
        <span className={styles.rowValue}>{formatEther(agreement.amount)} tCTC</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Freelance</span>
        <span className={styles.rowValue}>
          {agreement.freelancer.slice(0, 6)}...{agreement.freelancer.slice(-4)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Échéance</span>
        <span className={styles.rowValue}>
          {new Date(Number(agreement.deadline) * 1000).toLocaleDateString("fr-FR")}
        </span>
      </div>
      <button
        type="button"
        className={styles.actionButton}
        onClick={onConfirmMilestone}
        disabled={confirming || !canConfirm}
      >
        {confirming ? "Signature en cours..." : "Confirmer le jalon sur Sepolia"}
      </button>
    </div>
  );
}
