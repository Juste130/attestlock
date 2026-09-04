import Image from "next/image";
import Link from "next/link";
import WalletConnectButton from "./WalletConnectButton";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <Image className={styles.logo} src="/logo.svg" alt="AttestLock" width={40} height={34} priority />
        <span className={styles.wordmark}>AttestLock</span>
      </Link>
      <WalletConnectButton />
    </header>
  );
}
