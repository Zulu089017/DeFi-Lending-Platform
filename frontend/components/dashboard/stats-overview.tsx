"use client";
import { Stat } from "./stat";
import { Layers, Activity, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export function StatsOverview() {
  return (
    <div className="grid gap-4 rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={Layers} label="Total Value Locked" value="$12.4M" trend="+3.2%" />
      <Stat icon={Activity} label="24h Volume" value="$2.1M" trend="+11.4%" />
      <Stat icon={ArrowDownToLine} label="24h Wraps" value="312" trend="+22" />
      <Stat icon={ArrowUpFromLine} label="24h Unwraps" value="189" trend="-7" />
    </div>
  );
}
