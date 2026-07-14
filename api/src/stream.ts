import type { FastifyInstance } from "fastify";
import { WebSocketServer } from "ws";
import { prisma } from "./db.js";

/** WebSocket: pushes new indexer rows to any connected client as soon as
 *  the indexer commits them. We use Postgres LISTEN/NOTIFY for low-latency
 *  delivery; the scaffold polls every 1s and pushes the diff. */
export function attachWebsocket(app: FastifyInstance) {
  const wss = new WebSocketServer({ server: app.server, path: "/v1/stream" });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "hello", message: "openlend-stream" }));
  });

  const seen = {
    wrap: new Set<string>(),
    unwrap: new Set<string>(),
    lending: new Set<string>(),
  };

  setInterval(async () => {
    const [wraps, unwraps, lending] = await Promise.all([
      prisma.wrapEvent.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
      prisma.unwrapEvent.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
      prisma.lendingEvent.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
    ]);

    const broadcast = (event: any) => {
      const payload = JSON.stringify(event);
      wss.clients.forEach((c) => c.readyState === 1 && c.send(payload));
    };

    for (const w of wraps) {
      if (!seen.wrap.has(w.id)) {
        seen.wrap.add(w.id);
        broadcast({ type: "wrap", data: w });
      }
    }
    for (const u of unwraps) {
      if (!seen.unwrap.has(u.id)) {
        seen.unwrap.add(u.id);
        broadcast({ type: "unwrap", data: u });
      }
    }
    for (const l of lending) {
      if (!seen.lending.has(l.id)) {
        seen.lending.add(l.id);
        broadcast({ type: "lending", data: l });
      }
    }

    // GC
    if (seen.wrap.size > 5_000) seen.wrap = new Set(Array.from(seen.wrap).slice(-1_000));
    if (seen.unwrap.size > 5_000) seen.unwrap = new Set(Array.from(seen.unwrap).slice(-1_000));
    if (seen.lending.size > 5_000) seen.lending = new Set(Array.from(seen.lending).slice(-1_000));
  }, 1_000);
}
