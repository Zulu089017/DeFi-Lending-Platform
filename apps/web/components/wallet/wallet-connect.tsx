"use client";

import { Button } from "@/components/ui/button";
import {
  Wallet,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  Download,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useWallet } from "./wallet-provider";

export function WalletConnect() {
  const { account, isConnecting, error, connectFreighter, connectEvm, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  function shorten(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  async function copyAddress() {
    if (!account) return;
    const addr = account.kind === "freighter" ? account.publicKey : account.address;
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Connected ──
  if (account) {
    const addr = account.kind === "freighter" ? account.publicKey : account.address;
    const network = account.kind === "freighter" ? account.network : `chain ${account.chainId}`;
    const label = account.kind === "freighter" ? "Freighter" : "EVM";

    return (
      <div className="flex items-center gap-2">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{network}</span>
        </div>

        <div className="relative flex items-center">
          <Button
            size="sm"
            variant="secondary"
            className="font-mono text-xs pr-8"
            onClick={copyAddress}
            title="Click to copy address"
          >
            <span className="mr-2 h-2 w-2 rounded-full bg-success animate-pulse" />
            {shorten(addr)}
          </Button>
          <button
            className="absolute right-1.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={copyAddress}
            title="Copy address"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-solana" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={disconnect}
          title="Disconnect"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-danger">{error}</span>
        <Button size="sm" variant="outline" onClick={connectFreighter}>
          Retry
        </Button>
      </div>
    );
  }

  // ── Connecting ──
  if (isConnecting) {
    return (
      <Button size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Connecting…
      </Button>
    );
  }

  // ── Disconnected ──
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={connectFreighter} className="group">
        <Wallet className="mr-2 h-4 w-4" />
        <span>Freighter</span>
      </Button>
      <Button size="sm" variant="outline" onClick={connectEvm}>
        <Wallet className="mr-2 h-4 w-4" />
        <span>EVM</span>
      </Button>
    </div>
  );
}
