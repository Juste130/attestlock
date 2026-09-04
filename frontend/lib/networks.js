// FR : Parametres des deux reseaux impliques, au format attendu par MetaMask
//      (`wallet_addEthereumChain` / `wallet_switchEthereumChain`). Chain ID Creditcoin CC3
//      Testnet = 102031 (confirme via l'explorateur Blockscout du testnet).
// EN : Parameters for the two networks involved, in the format MetaMask expects
//      (`wallet_addEthereumChain` / `wallet_switchEthereumChain`). Creditcoin CC3 Testnet
//      chain id = 102031 (confirmed via the testnet's Blockscout explorer).

export const SEPOLIA_NETWORK = {
  chainId: "0xaa36a7", // 11155111
  chainName: "Ethereum Sepolia",
  nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export const CREDITCOIN_TESTNET_NETWORK = {
  chainId: "0x18e8f", // 102031
  chainName: "Creditcoin CC3 Testnet",
  nativeCurrency: { name: "Testnet CTC", symbol: "tCTC", decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL ?? "https://rpc.cc3-testnet.creditcoin.network"],
  blockExplorerUrls: ["https://creditcoin-testnet.blockscout.com"],
};

// FR : Identifiant Attestcoin interne pour Sepolia (different du chainId EVM 11155111) --
//      necessaire pour appeler ASCEscrowVerifier.execute(...).
// EN : Attestcoin-internal identifier for Sepolia (different from EVM chainId 11155111) --
//      needed to call ASCEscrowVerifier.execute(...).
export const SEPOLIA_CHAIN_KEY = Number(process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_KEY ?? 1);
