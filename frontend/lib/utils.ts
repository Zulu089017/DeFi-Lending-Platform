import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shorten(addr: string, n = 6) {
  if (addr.length <= n * 2) return addr;
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

export function formatNumber(n: number | bigint, decimals = 2): string {
  const v = typeof n === "bigint" ? Number(n) : n;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(decimals)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(decimals)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(decimals)}K`;
  return v.toFixed(decimals);
}
