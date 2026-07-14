"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function SupplyCard() {
  const [asset, setAsset] = useState("XLM");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    await new Promise((r) => setTimeout(r, 1_500));
    setPending(false);
    setAmount("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supply</CardTitle>
        <CardDescription>Earn variable APY by supplying assets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Asset</Label>
          <Input value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} />
        </div>
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
        </div>
        <div className="rounded-md border border-border/60 bg-card/30 p-3 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Supply APY</span><span className="text-success">3.42%</span></div>
          <div className="flex justify-between"><span>Collateral LTV</span><span>75%</span></div>
        </div>
        <Button onClick={submit} disabled={pending || !amount} className="w-full">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? "Supplying…" : "Supply"}
        </Button>
      </CardContent>
    </Card>
  );
}
