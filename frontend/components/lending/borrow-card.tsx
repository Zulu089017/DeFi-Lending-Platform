"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function BorrowCard() {
  const [collateral, setCollateral] = useState("XLM");
  const [cAmount, setCAmount] = useState("");
  const [debt, setDebt] = useState("USDC");
  const [bAmount, setBAmount] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    await new Promise((r) => setTimeout(r, 1_500));
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Borrow</CardTitle>
        <CardDescription>Draw against your supplied collateral.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Collateral</Label>
            <Input value={collateral} onChange={(e) => setCollateral(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" value={cAmount} onChange={(e) => setCAmount(e.target.value)} placeholder="0.0" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Borrow</Label>
            <Input value={debt} onChange={(e) => setDebt(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" value={bAmount} onChange={(e) => setBAmount(e.target.value)} placeholder="0.0" />
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-card/30 p-3 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Projected health factor</span><span className="text-success">1.85</span></div>
          <div className="flex justify-between"><span>Borrow APY</span><span className="text-danger">5.10%</span></div>
        </div>
        <Button onClick={submit} disabled={pending || !cAmount || !bAmount} className="w-full">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? "Borrowing…" : "Borrow"}
        </Button>
      </CardContent>
    </Card>
  );
}
