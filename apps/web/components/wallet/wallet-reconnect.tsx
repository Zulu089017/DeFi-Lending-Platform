"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "./wallet-provider";

/**
 * WalletReconnect — attempts to restore a previously-connected wallet
 * session on mount. Handles Freighter and EVM wallets.
 *
 * Place this component inside <WalletProvider> in your layout.
 */
export function WalletReconnect() {
  const { account, connectFreighter, connectEvm } = useWallet();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || account) return;
    attempted.current = true;

    // Try to restore the last connected wallet kind from localStorage
    const raw = localStorage.getItem("spg:wallet");
    if (!raw) return;

    try {
      const stored = JSON.parse(raw);
      if (stored.kind === "freighter") {
        connectFreighter().catch(() => {});
      } else if (stored.kind === "ethereum") {
        connectEvm().catch(() => {});
      }
    } catch {
      localStorage.removeItem("spg:wallet");
    }
  }, [account, connectFreighter, connectEvm]);

  return null; // No UI — invisible auto-reconnect
}
