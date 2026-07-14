"use client";
import { useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Mode = "wrap" | "unwrap";
type Chain = "ethereum" | "polygon" | "solana";

const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
};

const CHAIN_BADGE: Record<Chain, "ethereum" | "polygon" | "solana"> = {
  ethereum: "ethereum",
  polygon: "polygon",
  solana: "solana",
};

export function BridgeWidget() {
  const [mode, setMode] = useState<Mode>("wrap");
  const [chain, setChain] = useState<Chain>("ethereum");
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setStatus("Submitting source-chain transaction…");
    try {
      // Stubbed — production calls the SDK wrapper.
      await new Promise((r) => setTimeout(r, 1_500));
      setStatus("Waiting for Stellar finality…");
      await new Promise((r) => setTimeout(r, 1_500));
      setStatus("✅ Done — tokens minted to your Stellar account.");
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "failed"}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="space-y-5 p-6">
        <div className="flex gap-2">
          <Button
            variant={mode === "wrap" ? "default" : "outline"}
            onClick={() => setMode("wrap")}
            className="flex-1"
            size="sm"
          >
            Wrap
          </Button>
          <Button
            variant={mode === "unwrap" ? "default" : "outline"}
            onClick={() => setMode("unwrap")}
            className="flex-1"
            size="sm"
          >
            Unwrap
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Source chain</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CHAIN_LABELS) as Chain[]).map((c) => (
              <button
                key={c}
                onClick={() => setChain(c)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-all ${
                  chain === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-card/80"
                }`}
              >
                <Badge variant={CHAIN_BADGE[c]} className="mr-2">{CHAIN_LABELS[c]}</Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>From ({mode === "wrap" ? "source token" : "wTKN on Stellar"})</Label>
          <div className="flex gap-2">
            <Input
              placeholder="0xA0b8… or wTKN address"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
            />
          </div>
        </div>

        <div className="grid place-items-center">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card/50">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Amount</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button variant="outline" onClick={() => setAmount("100")}>MAX</Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card/30 p-3 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Bridge fee</span><span>0.10%</span></div>
          <div className="flex justify-between"><span>Estimated time</span><span>~45s</span></div>
          <div className="flex justify-between"><span>Rate</span><span>1 : 1</span></div>
        </div>

        <Button onClick={submit} disabled={pending || !amount || !dest} className="w-full" size="lg">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? "Bridging…" : `${mode === "wrap" ? "Wrap" : "Unwrap"} now`}
        </Button>

        {status && (
          <div className="rounded-md border border-border/60 bg-card/30 p-3 text-sm text-foreground/90 animate-fade-in">
            {status}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
