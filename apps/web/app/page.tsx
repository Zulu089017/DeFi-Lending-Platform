import Link from "next/link";
import {
  ArrowRight,
  Waypoints,
  Shield,
  Zap,
  Activity,
  ArrowDown,
  Check,
  Star,
  TrendingUp,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventFeedPreview } from "@/components/events/event-feed-preview";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { LiveTicker } from "@/components/events/live-ticker";

const chains = [
  { name: "Stellar", color: "bg-stellar", text: "text-white" },
  { name: "Ethereum", color: "bg-ethereum", text: "text-white" },
  { name: "Polygon", color: "bg-polygon", text: "text-white" },
  { name: "Solana", color: "bg-solana", text: "text-black" },
];

const features = [
  {
    icon: Waypoints,
    title: "Cross-Chain Wrapping",
    desc: "Lock tokens on Ethereum, Polygon or Solana and receive a Stellar-native wrapped asset in seconds. No bridges, no waiting.",
    highlight: "Sub-5s finality",
  },
  {
    icon: Shield,
    title: "Automated Liquidations",
    desc: "Permissionless liquidation engine runs on Soroban. Positions are settled atomically — no liquidator bots needed.",
    highlight: "100% on-chain",
  },
  {
    icon: Zap,
    title: "Sub-Cent Transactions",
    desc: "Stellar's consensus enables fees of ~$0.000005 per transaction. Lend and borrow without worrying about gas costs.",
    highlight: "~$0.000005/tx",
  },
  {
    icon: TrendingUp,
    title: "Dynamic Rate Model",
    desc: "Kinked interest rate curves adjust automatically based on utilization. Suppliers earn more when demand is high.",
    highlight: "Adaptive rates",
  },
  {
    icon: Lock,
    title: "Non-Custodial",
    desc: "Assets are held in Soroban smart contracts, not by a centralized custodian. You maintain full control of your keys.",
    highlight: "Self-custody",
  },
  {
    icon: Activity,
    title: "Real-Time Streaming",
    desc: "Every cross-chain mint, lend, borrow, and liquidation is streamed via WebSocket to the dashboard and SDK.",
    highlight: "Live events",
  },
];

const steps = [
  {
    step: "01",
    title: "Connect Wallet",
    desc: "Link your Freighter or any Stellar-compatible wallet to get started. One click, no KYC.",
  },
  {
    step: "02",
    title: "Bridge Assets",
    desc: "Lock tokens on your source chain. The bridge attests the lock and mints wrapped assets on Stellar.",
  },
  {
    step: "03",
    title: "Supply & Earn",
    desc: "Deposit wrapped assets into lending pools. Earn dynamic yield based on utilization.",
  },
  {
    step: "04",
    title: "Borrow & Leverage",
    desc: "Borrow against your supplied collateral. Use borrowed assets across the Stellar DeFi ecosystem.",
  },
];

const stats = [
  { value: "$12.4M", label: "Total Value Locked" },
  { value: "47K+", label: "Total Users" },
  { value: "3.2M", label: "Transactions" },
  { value: "8", label: "Supported Chains" },
];

const testimonials = [
  {
    quote: "StellarPay's cross-chain wrapping is the fastest I've seen. Moving USDC from Ethereum to Stellar takes seconds, not minutes.",
    author: "DeFi Builder",
    role: "Protocol Developer",
  },
  {
    quote: "The automated liquidation engine on Soroban is a game-changer. No more gas wars or MEV extraction during liquidations.",
    author: "Security Researcher",
    role: "Smart Contract Auditor",
  },
];

const faqs = [
  {
    q: "What makes StellarPay different from other lending protocols?",
    a: "StellarPay combines cross-chain asset wrapping with Stellar's sub-5-second finality and sub-cent transaction fees, creating the fastest and cheapest lending experience in DeFi.",
  },
  {
    q: "How does the bridge work?",
    a: "When you lock tokens on Ethereum/Polygon/Solana, our off-chain bridge middleware watches for the Lock event, collects Ed25519 signatures from attesters, and submits a mint transaction to the Soroban lending controller.",
  },
  {
    q: "Is the protocol audited?",
    a: "The smart contracts are currently in development. A formal audit by a top-tier firm is planned before mainnet launch. See our security policy for details.",
  },
  {
    q: "What assets can I supply and borrow?",
    a: "Initially: XLM, wETH, wUSDC, wSOL, and wMATIC. Additional assets can be added through governance proposals once the governance module is live.",
  },
];

export default function Home() {
  return (
    <div className="relative">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-hero-grid bg-[size:64px_64px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-stellar/10 blur-[128px]" />
        <div className="absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-polygon/10 blur-[128px]" />

        <div className="container relative py-24 lg:py-36">
          <div className="mx-auto max-w-4xl text-center animate-fade-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
              <span className="h-2 w-2 animate-pulse-glow rounded-full bg-stellar" />
              Live on Stellar Testnet
              <span className="mx-1 text-border">|</span>
              <Star className="h-3.5 w-3.5 text-solana" />
              <span>v1.0.0-beta</span>
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              The fastest way to{" "}
              <span className="text-gradient">lend and borrow</span>{" "}
              across chains.
            </h1>
            <p className="mt-6 text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
              StellarPay wraps any token from any chain into a Stellar-native asset.
              Supply, borrow, and earn with sub-cent fees and 5-second finality —
              powered by Soroban smart contracts.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="group h-12 px-8 text-base">
                <Link href="/bridge">
                  Start bridging
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                <Link href="/dashboard">Explore dashboard</Link>
              </Button>
            </div>

            {/* Chain badges */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Available on:</span>
              {chains.map((c) => (
                <Badge key={c.name} variant="secondary" className={`${c.color} ${c.text} text-xs`}>
                  {c.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-20">
            <StatsOverview />
          </div>
        </div>
      </section>

      <LiveTicker />

      {/* ── Stats Bar ── */}
      <section className="border-b border-border/40 bg-card/30">
        <div className="container py-10">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-gradient sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="border-b border-border/40 py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground">
              Four simple steps to start lending and borrowing across chains.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.step} className="relative flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                {i < steps.length - 1 && (
                  <ArrowDown className="mt-4 hidden h-5 w-5 text-border lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-b border-border/40 py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for cross-chain capital
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every primitive you expect from a modern lending protocol, engineered for
              Stellar&apos;s performance.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="group relative overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <CardHeader>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{f.highlight}</Badge>
                  </div>
                  <CardDescription className="text-sm leading-relaxed">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="border-b border-border/40 py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Trusted by DeFi builders
            </h2>
            <p className="mt-4 text-muted-foreground">
              Hear from developers and auditors building on StellarPay.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            {testimonials.map((t) => (
              <Card key={t.author} className="relative overflow-hidden border-border/60">
                <CardHeader>
                  <div className="mb-3 flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-solana text-solana" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {t.author[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{t.author}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Feed + CTA ── */}
      <section className="border-b border-border/40 py-24">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                See every cross-chain mint, live.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Powered by the Horizon streaming API and our own indexer. Watch tokens leave
                Ethereum and arrive on Stellar in real-time.
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

      {/* ── FAQ ── */}
      <section className="border-b border-border/40 py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="mx-auto mt-16 max-w-2xl divide-y divide-border/40">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between text-lg font-medium">
                  {faq.q}
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24">
        <div className="container">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-12 text-center backdrop-blur">
            <div className="absolute inset-0 bg-gradient-to-br from-stellar/5 via-transparent to-polygon/5" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to start lending?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Bridge your first asset in under 60 seconds. No KYC, no minimum deposit.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="group h-12 px-8">
                  <Link href="/bridge">
                    Launch app
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-8">
                  <Link href="/docs">Read the docs</Link>
                </Button>
              </div>
              <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-solana" /> No KYC
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-solana" /> No minimum
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-solana" /> 5-second finality
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
