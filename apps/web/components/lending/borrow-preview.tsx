"use client";

import { useState, useMemo } from "react";
import { Calculator, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BorrowPreviewProps {
  collateralAmount: string;
  collateralAsset: string;
  collateralUsd: number;
  borrowAsset: string;
  ltvBps: number;
}

export function BorrowPreview({
  collateralAmount,
  collateralAsset,
  collateralUsd,
  borrowAsset,
  ltvBps,
}: BorrowPreviewProps) {
  const [borrowAmount, setBorrowAmount] = useState("");

  const preview = useMemo(() => {
    const amount = parseFloat(borrowAmount) || 0;
    const maxBorrow = (collateralUsd * ltvBps) / 10000;
    const newDebt = amount;
    const healthFactor = newDebt > 0 ? collateralUsd / newDebt : Infinity;
    const utilization = maxBorrow > 0 ? (newDebt / maxBorrow) * 100 : 0;

    return {
      maxBorrow,
      healthFactor,
      utilization,
      isSafe: healthFactor >= 1.25,
      isRisky: healthFactor >= 1.0 && healthFactor < 1.25,
      isDangerous: healthFactor < 1.0,
    };
  }, [borrowAmount, collateralUsd, ltvBps]);

  return (
    <div className="space-y-4 rounded-lg border border-border/40 p-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Borrow Preview</span>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">
          Amount to borrow ({borrowAsset})
        </label>
        <input
          type="number"
          value={borrowAmount}
          onChange={(e) => setBorrowAmount(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {borrowAmount && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max borrow</span>
            <span className="font-mono">${preview.maxBorrow.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Health factor</span>
            <span className={`font-mono ${preview.isSafe ? "text-solana" : "text-danger"}`}>
              {preview.healthFactor === Infinity ? "∞" : preview.healthFactor.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Utilization</span>
            <span className="font-mono">{preview.utilization.toFixed(1)}%</span>
          </div>

          {preview.isSafe && (
            <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-2 text-xs text-solana">
              <CheckCircle className="h-3.5 w-3.5" />
              Position is safe
            </div>
          )}
          {preview.isRisky && (
            <div className="flex items-center gap-1.5 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Position is near liquidation threshold
            </div>
          )}
          {preview.isDangerous && (
            <div className="flex items-center gap-1.5 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              Position would be underwater — borrow rejected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
