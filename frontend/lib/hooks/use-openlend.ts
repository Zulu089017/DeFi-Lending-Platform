"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface StreamEvent {
  type: "wrap" | "unwrap" | "lending" | "bridge";
  data: any;
  receivedAt: number;
}

/** Subscribes to the OpenLend WebSocket stream. Auto-reconnects with backoff. */
export function useOpenLendStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    const url = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/^http/, "ws") + "/v1/stream";
    let cancelled = false;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttempts.current = 0;
      };
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data as string) as Omit<StreamEvent, "receivedAt">;
          if (parsed.type === "hello") return;
          setEvents((prev) => [{ ...parsed, receivedAt: Date.now() }, ...prev].slice(0, 200));
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempts.current++);
        setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  return useMemo(() => events, [events]);
}

/** Fetches markets, polls every 30s. */
export function useMarkets() {
  const [markets, setMarkets] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/markets`);
      const d = await r.json();
      if (!cancelled) setMarkets(d);
    };
    fetchOnce();
    const t = setInterval(fetchOnce, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  return markets;
}
