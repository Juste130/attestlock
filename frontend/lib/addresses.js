// FR : Adresses des contrats deployes. Prefixe NEXT_PUBLIC_ obligatoire pour que Next.js les
//      expose au navigateur (les variables sans ce prefixe restent server-only). Vides tant
//      que l'etape de deploiement testnet n'a pas ete faite -- voir .env.example a la racine.
// EN : Deployed contract addresses. NEXT_PUBLIC_ prefix required for Next.js to expose them to
//      the browser (variables without it stay server-only). Empty until the testnet deployment
//      step has been done -- see .env.example at the repo root.
export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "";
export const ASC_ESCROW_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_ASC_ESCROW_VERIFIER_ADDRESS ?? "";
export const SOURCE_MILESTONE_ADDRESS = process.env.NEXT_PUBLIC_SOURCE_MILESTONE_ADDRESS ?? "";
