"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletKind = "none" | "freighter" | "ethereum";
export type Network = "testnet" | "mainnet";

export interface StellarAccount {
  kind: "freighter";
  publicKey: string;
  network: Network;
}

export interface EvmAccount {
  kind: "ethereum";
  address: string;
  chainId: number;
}

export type WalletAccount = StellarAccount | EvmAccount;

export interface WalletState {
  account: WalletAccount | null;
  isConnecting: boolean;
  error: string | null;
  connectFreighter: () => Promise<void>;
  connectEvm: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (_xdr: string) => Promise<string>;
  getNetwork: () => Promise<Network>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WalletContext = createContext<WalletState | null>(null);

const STORAGE_KEY = "spg:wallet";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _isFreighterInstalled(): boolean {
  return !!(window as any).freighterApi;
}

function _isEvmInstalled(): boolean {
  return !!(window as any).ethereum;
}

function persist(account: WalletAccount | null) {
  if (account) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function restore(): WalletAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.kind === "freighter" && parsed.publicKey) return parsed;
    if (parsed.kind === "ethereum" && parsed.address) return parsed;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<WalletAccount | null>(restore);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Freighter ─────────────────────────────────────────────────────

  const connectFreighter = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const api = (window as any).freighterApi;
      if (!api) throw new Error("Freighter wallet not detected. Please install the Freighter extension.");

      await api.setAllowed();
      const publicKey: string = await api.getPublicKey();
      if (!publicKey) throw new Error("Failed to retrieve public key from Freighter.");

      const network: Network = await api.isConnected()
        ? "mainnet"
        : "testnet";

      const acc: StellarAccount = { kind: "freighter", publicKey, network };
      setAccount(acc);
      persist(acc);
    } catch (err: any) {
      setError(err.message ?? "Failed to connect Freighter");
      setAccount(null);
      persist(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ── EVM ───────────────────────────────────────────────────────────

  const connectEvm = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("No EVM wallet detected. Please install MetaMask or similar.");

      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts.length) throw new Error("No accounts authorized.");

      const chainId: string = await eth.request({ method: "eth_chainId" });
      const acc: EvmAccount = {
        kind: "ethereum",
        address: accounts[0],
        chainId: parseInt(chainId, 16),
      };
      setAccount(acc);
      persist(acc);
    } catch (err: any) {
      setError(err.message ?? "Failed to connect EVM wallet");
      setAccount(null);
      persist(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    setAccount(null);
    setError(null);
    persist(null);
  }, []);

  // ── Sign transaction (Freighter) ──────────────────────────────────

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!account || account.kind !== "freighter") {
        throw new Error("Freighter wallet not connected.");
      }
      const api = (window as any).freighterApi;
      if (!api?.signTransaction) {
        throw new Error("Freighter signTransaction not available.");
      }
      const result = await api.signTransaction(xdr, {
        network: account.network === "mainnet"
          ? "PUBLIC"
          : "TESTNET",
      });
      return result as string;
    },
    [account],
  );

  // ── Get network ───────────────────────────────────────────────────

  const getNetwork = useCallback(async (): Promise<Network> => {
    const api = (window as any).freighterApi;
    if (!api?.getNetwork) return "testnet";
    const net: string = await api.getNetwork();
    return net === "PUBLIC" ? "mainnet" : "testnet";
  }, []);

  // ── Effects ───────────────────────────────────────────────────────

  // Listen for EVM account / chain changes
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth?.on) return;

    const handleAccounts = (accts: string[]) => {
      if (!accts.length) disconnect();
      else if (account?.kind === "ethereum") {
        const updated = { ...account, address: accts[0] };
        setAccount(updated);
        persist(updated);
      }
    };
    const handleChain = () => {
      // Re-connect to refresh chainId
      if (account?.kind === "ethereum") connectEvm();
    };

    eth.on("accountsChanged", handleAccounts);
    eth.on("chainChanged", handleChain);
    return () => {
      eth.removeListener("accountsChanged", handleAccounts);
      eth.removeListener("chainChanged", handleChain);
    };
  }, [account, connectEvm, disconnect]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <WalletContext.Provider
      value={{
        account,
        isConnecting,
        error,
        connectFreighter,
        connectEvm,
        disconnect,
        signTransaction,
        getNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}
