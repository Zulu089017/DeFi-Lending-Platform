// NOTE: intentionally NOT a "use client" component. It is rendered from
// both a Server Component (app/dashboard/page.tsx, which passes Lucide
// icon *components* as props — forbidden across the Server→Client
// boundary) and from the client "StatsOverview" wrapper. As a shared
// component it has no hooks or browser APIs, so it works in both.
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({
  icon: Icon,
  label,
  value,
  trend,
  trendUp = true,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {trend && (
        <p className={cn("flex items-center gap-1 text-xs", trendUp ? "text-success" : "text-danger")}>
          {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend}
        </p>
      )}
    </div>
  );
}
