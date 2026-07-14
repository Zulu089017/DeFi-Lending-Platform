"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shorten, formatNumber } from "@/lib/utils";

const DEMO = [
  { user: "GABC…XYZ", collat: "XLM", debt: "USDC", hf: 0.92, repay: 12500 },
  { user: "GDEF…UVW", collat: "BTC", debt: "USDC", hf: 1.04, repay: 7800 },
  { user: "GGHI…RST", collat: "ETH", debt: "USDC", hf: 1.18, repay: 4200 },
  { user: "GJKL…OPQ", collat: "XLM", debt: "USDC", hf: 0.97, repay: 22000 },
];

export function LiquidationMonitor() {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Borrower</th>
              <th className="px-4 py-3">Collateral</th>
              <th className="px-4 py-3">Debt</th>
              <th className="px-4 py-3 text-right">Health factor</th>
              <th className="px-4 py-3 text-right">Max repay</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {DEMO.map((p) => (
              <tr key={p.user} className="transition-colors hover:bg-accent/5">
                <td className="px-4 py-3 font-mono text-xs">{p.user}</td>
                <td className="px-4 py-3"><Badge variant="stellar">{p.collat}</Badge></td>
                <td className="px-4 py-3">{p.debt}</td>
                <td className="px-4 py-3 text-right">
                  <HF value={p.hf} />
                </td>
                <td className="px-4 py-3 text-right font-mono">${formatNumber(p.repay)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant={p.hf < 1 ? "danger" : "outline"}>Liquidate</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function HF({ value }: { value: number }) {
  const color = value < 1 ? "danger" : value < 1.2 ? "warning" : "success";
  return <Badge variant={color as any}>{value.toFixed(2)}</Badge>;
}
