"use client";

import { useState } from "react";
import Image from "next/image";
import Header from "@/components/Header";
import CreateEscrowForm from "@/components/CreateEscrowForm";
import EscrowFlow from "@/components/EscrowFlow";
import styles from "./page.module.css";

export default function Home() {
  const [trackedEscrowId, setTrackedEscrowId] = useState(null);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.hero}>
          <Image className={styles.heroLogo} src="/logo.svg" alt="" width={56} height={47} priority aria-hidden="true" />
          <div>
            <h1 className={styles.heroTitle}>AttestLock</h1>
            <p className={styles.tagline}>Preuve avant confiance</p>
          </div>
        </div>

        {trackedEscrowId ? (
          <EscrowFlow escrowId={trackedEscrowId} onReset={() => setTrackedEscrowId(null)} />
        ) : (
          <CreateEscrowForm onCreated={setTrackedEscrowId} onTrack={setTrackedEscrowId} />
        )}
      </main>
    </>
  );
}
