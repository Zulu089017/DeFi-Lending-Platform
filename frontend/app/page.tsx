import Link from "next/link";
import { ArrowRight, Bridge, Shield, Zap, Activity, GitBranch, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventFeedPreview } from "@/components/events/event-feed-preview";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { LiveTicker } from "@/components/events/live-ticker";

const features = [
  {
    icon: Bridge,
    title: "Wrap from any chain",
    desc: "Lock tokens on Ethereum, Polygon or Solana and receive a Stellar-native wrapped asset in seconds.",
  },
  {
    icon: Zap,
    title: "Stellar-fast settlement",
    desc: "Sub-5-second finality. A fraction of a cent per transaction. Built for high-frequency DeFi.",
  },
  {
    icon: Shield,
    title: "Automated liquidation",
    desc: "Permissionless liquidation engine. No liquidators-for-hire. Positions are settled in one transaction.",
  },
  {
    icon: Activity,
    title: "Real-time transparency",
    desc: "Every cross-chain mint, lend, borrow, and liquidation is streamed live to this dashboard.",
  },
  {
    icon: Layers,
    title: "Composable SDK",
    desc: "TypeScript SDK + REST/WS API. Build lending products on top of OpenLend in an afternoon.",
  },
  {
    icon: GitBranch,
    title: "Polyrepo architecture",
    desc: "Each component is independent. Run only what you need. Deploy to your own infra.",
  },
];

export default function Home() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-hero-grid bg-[size:64px_64px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="container relative py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-stellar" />
              Live on Stellar Testnet
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Cross-chain lending,{" "}
              <span className="text-gradient">settled on Stellar.</span>
            </h1>
            <p className="mt-6 text-balance text-lg text-muted-foreground sm:text-xl">
              OpenLend is a middleware that lets any token on any chain become a Stellar-native wrapped asset — and then lend, borrow, and earn against it with sub-cent fees and 5-second finality.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="group">
                <Link href="/bridge">
                  Bridge your first asset
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dashboard">View dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16">
            <StatsOverview />
          </div>
        </div>
      </section>

      <LiveTicker />

      {/* Features */}
      <section className="border-b border-border/40 py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for cross-chain capital
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every primitive you'd expect from a modern lending protocol, plus the cross-chain layer.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="group relative overflow-hidden">
                <CardHeader>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Live feed preview */}
      <section className="py-24">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                See every cross-chain mint, live.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Powered by the Horizon streaming API and our own indexer. Watch tokens leave Ethereum and arrive on Stellar in real-time.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/liquidations">Liquidation monitor</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard">Full dashboard</Link>
                </Button>
              </div>
            </div>
            <EventFeedPreview />
          </div>
        </div>
      </section>
    </div>
  );
}
