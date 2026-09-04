"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { connectWallet, isWalletAvailable, switchNetwork as switchNetworkImpl } from "./wallet";

// FR : Un seul wallet connecte a la fois, partage par toute la page (formulaire de creation
//      d'escrow + suivi) -- un Context React suffit, pas besoin d'une lib de gestion d'etat
//      pour un seul morceau d'etat partage.
// EN : A single connected wallet at a time, shared across the whole page (escrow creation form
//      + tracker) -- a React Context is enough, no state-management library needed for a
//      single piece of shared state.
const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // FR : Retourne le signer directement (pas seulement via le state React) -- un appelant qui
  //      enchaine `await connect()` puis une transaction ne doit pas dependre du timing du
  //      prochain re-render pour recuperer un signer a jour.
  // EN : Returns the signer directly (not only through React state) -- a caller chaining
  //      `await connect()` then a transaction must not depend on the next re-render's timing
  //      to get an up-to-date signer.
  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const { signer: newSigner } = await connectWallet();
      setSigner(newSigner);
      setAddress(await newSigner.getAddress());
      return newSigner;
    } catch (err) {
      setError(err.message ?? String(err));
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async (networkConfig) => {
    setError(null);
    try {
      await switchNetworkImpl(networkConfig);
    } catch (err) {
      setError(err.message ?? String(err));
      throw err;
    }
  }, []);

  // FR : Si l'utilisateur change de compte dans son wallet, on se re-synchronise plutot que
  //      de continuer a signer silencieusement avec l'ancienne adresse.
  // EN : If the user switches accounts in their wallet, we re-sync rather than silently keep
  //      signing with the stale address.
  useEffect(() => {
    if (!isWalletAvailable()) return undefined;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAddress(null);
        setSigner(null);
      } else {
        connect();
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, [connect]);

  return (
    <WalletContext.Provider value={{ address, signer, error, connecting, connect, switchNetwork }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
