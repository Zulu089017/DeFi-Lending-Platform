"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/components/wallet/wallet-reconnect";

interface TxRecord {
  hash: string;
  type: "supply" | "withdraw" | "borrow" | "repay" | "liquidation" | "bridge";
  asset: string;
  amount: string;
  timestamp: string;
  status: "confirmed" | "pending" | "failed";
}

const typeConfig: Record<string, { label: string; icon: typeof ArrowUpRight; variant: string }> = {
  supply: { label: "Supply", icon: ArrowDownLeft, variant: "success" },
  withdraw: { label: "Withdraw", icon: ArrowUpRight, variant: "warning" },
  borrow: { label: "Borrow", icon: ArrowUpRight, variant: "danger" },
  repay: { label: "Repay", icon: ArrowDownLeft, variant: "success" },
  liquidation: { label: "Liquidation", icon: ArrowUpRight, variant: "danger" },
  bridge: { label: "Bridge", icon: ArrowUpRight, variant: "stellar" },
};

const MOCK_TX: TxRecord[] = [
  { hash: "0xabc123...def456", type: "supply", asset: "XLM", amount: "+50,000", timestamp: "2026-08-05 10:30", status: "confirmed" },
  { hash: "0xdef789...abc012", type: "borrow", asset: "wUSDC", amount: "-2,000", timestamp: "2026-08-05 09:15", status: "confirmed" },
  { hash: "0x345abc...789def", type: "bridge", asset: "wETH", amount: "+1.5", timestamp: "2026-08-04 22:45", status: "confirmed" },
  { hash: "0x012def...345abc", type: "repay", asset: "wUSDC", amount: "+1,000", timestamp: "2026-08-04 18:00", status: "confirmed" },
  { hash: "0x678abc...901def", type: "withdraw", asset: "XLM", amount: "-10,000", timestamp: "2026-08-03 14:20", status: "confirmed" },
];

export default function HistoryPage() {
  const [] = useState("all");
  const [txs] = useState<TxRecord[]>(MOCK_TX);

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
            <p className="mt-2 text-muted-foreground">View all your lending activity across chains.</p>
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </div>

        <div className="mt-8 space-y-1">
          {txs.map((tx) => {
            const cfg = typeConfig[tx.type];
            const Icon = cfg.icon;
            return (
              <div
                key={tx.hash}
                className="flex items-center justify-between rounded-lg border border-border/40 p-4 transition-colors hover:bg-accent/5"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${cfg.variant}/10`}>
                    <Icon className={`h-5 w-5 text-${cfg.variant}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cfg.label}</span>
                      <Badge variant="outline" className="text-[10px]">{tx.asset}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{tx.hash}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-mono text-sm font-medium ${tx.amount.startsWith("+") ? "text-solana" : "text-danger"}`}>
                    {tx.amount}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{tx.timestamp}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${tx.status === "confirmed" ? "bg-solana" : "bg-warning"}`} />
                  </div>
                </div>

                <Button variant="ghost" size="icon" className="ml-2" asChild>
                  <a href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
