import { Inter } from "next/font/google";
import { WalletProvider } from "@/lib/WalletContext";
import "../styles/tokens.css";

// FR : Une seule famille sans-serif, deux graisses (400/500) -- conforme a la charte
//      graphique. Inter est chargee via next/font pour eviter tout flash de police non
//      stylee (FOUT) et etre auto-hebergee (pas de requete externe a Google au runtime).
// EN : A single sans-serif family, two weights (400/500) -- matches the brand guide. Inter
//      is loaded via next/font to avoid any flash of unstyled text (FOUT) and to be
//      self-hosted (no external request to Google at runtime).
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata = {
  title: "AttestLock",
  description:
    "Escrow multi-parties sur Creditcoin, deblocage des fonds preuve par Attestcoin. / " +
    "Multi-party escrow on Creditcoin, funds released on Attestcoin-proven evidence.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
