import styles from "./EscrowFlow.module.css";

/** FR : Etat visuel 2 -- le jalon est confirme sur Sepolia, Attestcoin verifie la preuve
 *  cryptographique cote Creditcoin. Couleur Laiton : l'attente EST le processus d'attestation.
 *  EN : Visual state 2 -- the milestone is confirmed on Sepolia, Attestcoin is verifying the
 *  cryptographic proof on the Creditcoin side. Brass color: the wait IS the attestation
 *  process. */
export default function StateVerifying() {
  return (
    <div className={styles.stepCard} data-accent="pending">
      <h3 className={styles.stepTitle}>Preuve en cours de vérification</h3>
      <p className={styles.stepBody}>
        Le protocole Attestcoin attend l&apos;attestation du bloc Sepolia, puis vérifie la preuve
        Merkle et de continuité sur Creditcoin avant de débloquer les fonds.
      </p>
      <div className={styles.progressTrack} role="progressbar" aria-label="Vérification de la preuve en cours">
        <div className={styles.progressFill} />
      </div>
      <p className={styles.pendingText}>Attestation en cours...</p>
    </div>
  );
}
