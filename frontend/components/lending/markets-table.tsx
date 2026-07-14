"use client";
import { useMarkets } from "@/lib/hooks/use-openlend";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export function MarketsTable() {
  const markets = useMarkets();
  if (!markets.length) {
    return <div className="text-sm text-muted-foreground">Loading markets…</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Asset</th>
            <th className="px-3 py-2 text-right">Total Supply</th>
            <th className="px-3 py-2 text-right">Total Borrow</th>
            <th className="px-3 py-2 text-right">Utilization</th>
            <th className="px-3 py-2 text-right">Supply APY</th>
            <th className="px-3 py-2 text-right">Borrow APY</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {markets.map((m) => (
            <tr key={m.asset} className="transition-colors hover:bg-accent/5">
              <td className="px-3 py-3 font-medium">{m.asset}</td>
              <td className="px-3 py-3 text-right font-mono">${formatNumber(m.totalSupply)}</td>
              <td className="px-3 py-3 text-right font-mono">${formatNumber(m.totalBorrow)}</td>
              <td className="px-3 py-3 text-right">
                <UtilizationBar value={m.utilization} />
              </td>
              <td className="px-3 py-3 text-right text-success">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                {(m.supplyApy * 100).toFixed(2)}%
              </td>
              <td className="px-3 py-3 text-right text-danger">
                <TrendingDown className="mr-1 inline h-3 w-3" />
                {(m.borrowApy * 100).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UtilizationBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct < 60 ? "bg-success" : pct < 80 ? "bg-yellow-500" : "bg-danger";
  return (
    <div className="ml-auto flex w-32 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-xs">{pct}%</span>
    </div>
  );
}
