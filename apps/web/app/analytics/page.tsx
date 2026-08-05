"use client";

import { TrendingUp, DollarSign, Users, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  { icon: DollarSign, label: "Total Value Locked", value: "$12.4M", change: "+8.2%" },
  { icon: Users, label: "Active Users (24h)", value: "1,247", change: "+12.5%" },
  { icon: Activity, label: "Transactions (24h)", value: "3,842", change: "+3.1%" },
  { icon: TrendingUp, label: "Protocol Revenue", value: "$8,420", change: "+15.8%" },
];

const utilizationData = [
  { asset: "XLM", supplied: "$5M", borrowed: "$3.1M", util: 62 },
  { asset: "wETH", supplied: "$3M", borrowed: "$1.35M", util: 45 },
  { asset: "wUSDC", supplied: "$4.4M", borrowed: "$3.43M", util: 78 },
];

export default function AnalyticsPage() {
  return (
    <div className="container py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">Protocol Analytics</h1>
        <p className="mt-2 text-muted-foreground">Real-time metrics and utilization across all markets.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <Card key={m.label}>
              <CardHeader>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <m.icon className="h-4 w-4" />
                  <span className="text-xs">{m.label}</span>
                </div>
                <CardTitle className="text-2xl">{m.value}</CardTitle>
                <span className={`text-xs ${m.change.startsWith("+") ? "text-solana" : "text-danger"}`}>
                  {m.change}
                </span>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold">Market Utilization</h2>
          <div className="mt-4 space-y-3">
            {utilizationData.map((u) => (
              <div key={u.asset} className="rounded-lg border border-border/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{u.asset}</span>
                  <span className="text-sm text-muted-foreground">{u.util}% utilized</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-stellar to-polygon transition-all"
                    style={{ width: `${u.util}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Supplied: {u.supplied}</span>
                  <span>Borrowed: {u.borrowed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
