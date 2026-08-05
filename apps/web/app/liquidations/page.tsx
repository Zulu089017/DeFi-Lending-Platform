import { LiquidationMonitor } from "@/components/lending/liquidation-monitor";

export default function LiquidationsPage() {
  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Liquidation monitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Positions closest to liquidation. Click <em>Liquidate</em> to repay debt and seize discounted collateral.
        </p>
      </div>
      <LiquidationMonitor />
    </div>
  );
}
