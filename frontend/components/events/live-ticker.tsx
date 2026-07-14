"use client";
import { useOpenLendStream } from "@/lib/hooks/use-openlend";

export function LiveTicker() {
  const events = useOpenLendStream();
  if (events.length === 0) return null;
  const recent = events.slice(0, 12);
  return (
    <div className="border-b border-border/40 bg-card/30 py-2">
      <div className="container flex items-center gap-6 overflow-x-auto text-xs">
        {recent.map((e, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2 font-mono text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-stellar" />
            {e.type.toUpperCase()} · {e.data.amount?.toString?.() ?? ""} ·{" "}
            {e.data.txHash?.slice(0, 6)}…
          </span>
        ))}
      </div>
    </div>
  );
}
