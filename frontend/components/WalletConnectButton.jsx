"use client";

import { useWallet } from "@/lib/WalletContext";
import styles from "./WalletConnectButton.module.css";

function truncate(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnectButton() {
  const { address, connecting, error, connect } = useWallet();

  if (address) {
    return (
      <div className={styles.connected}>
        <span className={styles.dot} aria-hidden="true" />
        {truncate(address)}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className={styles.button} onClick={connect} disabled={connecting}>
        {connecting ? "Connexion..." : "Connecter le wallet"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
