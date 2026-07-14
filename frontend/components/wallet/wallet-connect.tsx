"use client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Wallet } from "lucide-react";

type WalletKind = "none" | "stellar" | "ethereum";
type Account = { kind: WalletKind; address: string };

const STORAGE = "openlend:wallet";

export function WalletConnect() {
  const [account, setAccount] = useState<Account | null>(null);

  async function connectStellar() {
    // @ts-ignore injected by Freighter
    const w = (window as any).freighterApi;
    if (!w) {
      alert("Install Freighter wallet for Stellar");
      return;
    }
    await w.setAllowed();
    const addr = await w.getPublicKey();
    setAccount({ kind: "stellar", address: addr });
    localStorage.setItem(STORAGE, JSON.stringify({ kind: "stellar", address: addr }));
  }

  async function connectEvm() {
    if (!(window as any).ethereum) {
      alert("No EVM wallet detected");
      return;
    }
    const accounts: string[] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
    setAccount({ kind: "ethereum", address: accounts[0] });
    localStorage.setItem(STORAGE, JSON.stringify({ kind: "ethereum", address: accounts[0] }));
  }

  if (account) {
    return (
      <Button size="sm" variant="secondary" className="font-mono">
        <span className="mr-2 h-2 w-2 rounded-full bg-success" />
        {account.address.slice(0, 4)}…{account.address.slice(-4)}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={connectStellar}>
        <Wallet className="mr-2 h-4 w-4" /> Stellar
      </Button>
      <Button size="sm" variant="outline" onClick={connectEvm}>
        <Wallet className="mr-2 h-4 w-4" /> EVM
      </Button>
    </div>
  );
}
