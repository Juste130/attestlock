import { formatEther } from "ethers";
import styles from "./EscrowFlow.module.css";

/** FR : Etat visuel 3 -- la preuve a ete verifiee, les fonds sont chez le freelance.
 *  EN : Visual state 3 -- the proof was verified, funds are with the freelancer. */
export default function StateUnlocked({ agreement }) {
  return (
    <div className={styles.stepCard} data-accent="success">
      <h3 className={styles.stepTitle}>Fonds débloqués</h3>
      <p className={styles.stepBody}>
        Attestcoin a vérifié la preuve venue de Sepolia. Le contrat Escrow a transféré les fonds
        au freelance, sans tiers de confiance centralisé.
      </p>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Montant transféré</span>
        <span className={`${styles.rowValue} ${styles.successText}`}>{formatEther(agreement.amount)} tCTC</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Destinataire</span>
        <span className={styles.rowValue}>
          {agreement.freelancer.slice(0, 6)}...{agreement.freelancer.slice(-4)}
        </span>
      </div>
    </div>
  );
}
