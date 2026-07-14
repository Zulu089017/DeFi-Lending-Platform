"use client";
import { useOpenLendStream } from "@/lib/hooks/use-openlend";
import { Badge } from "@/components/ui/badge";
import { Activity, ArrowDown, ArrowUp, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function EventFeed({ limit = 50, compact = false }: { limit?: number; compact?: boolean }) {
  const events = useOpenLendStream();
  const items = events.slice(0, limit);
  if (items.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground", compact ? "py-6" : "")}>
        <Activity className="h-6 w-6 animate-pulse" />
        <p className="text-sm">Waiting for live events…</p>
      </div>
    );
  }
  return (
    <ul className={cn("divide-y divide-border/40", compact ? "max-h-80 overflow-auto" : "")}>
      {items.map((e, i) => (
        <li key={i} className="flex items-center justify-between px-1 py-2 text-sm transition-colors hover:bg-accent/5">
          <div className="flex items-center gap-3">
            <EventIcon type={e.type} />
            <div>
              <p className="font-medium">
                {e.type === "wrap" && <>🌉 Wrap · {e.data.amount?.toString?.() ?? e.data.amount}</>}
                {e.type === "unwrap" && <>🔓 Unwrap · {e.data.amount?.toString?.() ?? e.data.amount}</>}
                {e.type === "lending" && (
                  <>⚡ {e.data.type} {e.data.asset} · {e.data.amount?.toString?.() ?? e.data.amount}</>
                )}
                {e.type === "bridge" && (
                  <>🌐 {e.data.type} · {e.data.token}</>
                )}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {e.data.txHash?.slice(0, 10)}…{e.data.txHash?.slice(-6)}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(e.receivedAt).toLocaleTimeString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EventIcon({ type }: { type: string }) {
  const iconClass = "h-4 w-4";
  if (type === "wrap") return <Badge variant="stellar" className="grid h-7 w-7 place-items-center p-0"><ArrowDown className={iconClass} /></Badge>;
  if (type === "unwrap") return <Badge variant="polygon" className="grid h-7 w-7 place-items-center p-0"><ArrowUp className={iconClass} /></Badge>;
  if (type === "lending") return <Badge variant="secondary" className="grid h-7 w-7 place-items-center p-0">⚡</Badge>;
  return <Badge variant="outline" className="grid h-7 w-7 place-items-center p-0"><Flame className={iconClass} /></Badge>;
}
