import { BrowserProvider } from "ethers";

// FR : Connexion wallet minimale via window.ethereum (MetaMask ou compatible), sans
//      bibliotheque tierce (wagmi/rainbowkit) -- un seul flux d'usage (connecter, changer de
//      reseau, signer) ne justifie pas cette dependance supplementaire.
// EN : Minimal wallet connection via window.ethereum (MetaMask or compatible), no third-party
//      library (wagmi/rainbowkit) -- a single usage flow (connect, switch network, sign)
//      doesn't justify that extra dependency.

export function isWalletAvailable() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/** FR : Demande la connexion et retourne un provider + signer ethers v6.
 *  EN : Requests connection and returns an ethers v6 provider + signer. */
export async function connectWallet() {
  if (!isWalletAvailable()) {
    throw new Error("Aucun wallet detecte (installe MetaMask) / No wallet detected (install MetaMask)");
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return { provider, signer };
}

/**
 * FR : Bascule le wallet vers le reseau donne ; si le wallet ne le connait pas encore
 * (erreur 4902), propose de l'ajouter plutot que de simplement echouer.
 * EN : Switches the wallet to the given network; if the wallet doesn't know it yet
 * (error 4902), offers to add it instead of just failing.
 */
export async function switchNetwork(networkConfig) {
  if (!isWalletAvailable()) {
    throw new Error("Aucun wallet detecte / No wallet detected");
  }
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: networkConfig.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [networkConfig],
      });
    } else {
      throw switchError;
    }
  }
}
