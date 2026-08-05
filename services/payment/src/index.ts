import { createServer } from "node:http";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { EthereumWatcher } from "./chains/ethereum.js";
import { PolygonWatcher } from "./chains/polygon.js";
import { SolanaWatcher } from "./chains/solana.js";
import { StellarWatcher } from "./chains/stellar.js";
import { StellarMinter } from "./mint/stellarMinter.js";
import { stellarPayment } from "./stellarPayment.js";
import { prisma } from "./store/db.js";

let running = true;
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Minimal HTTP server so the k8s liveness/readiness probes on :4100/health
 *  can succeed. The bridge itself is a poller; this endpoint is the only
 *  HTTP surface it exposes. */
function startHealthServer() {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "spg-bridge", uptime: process.uptime() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(config.PORT, config.HOST, () => {
    logger.info({ port: config.PORT }, "health server listening");
  });
  return server;
}

async function main() {
  logger.info("🚀 StellarPay bridge starting");

  const eth = new EthereumWatcher();
  const poly = new PolygonWatcher();
  const sol = new SolanaWatcher();
  const stellarW = new StellarWatcher();
  const minter = new StellarMinter();

  await Promise.all([eth.start(), poly.start(), sol.start(), stellarW.start()]);

  const tick = async () => {
    if (!running) return;
    try {
      const [ethEvs, polyEvs, solEvs] = await Promise.all([
        eth.pollOnce(),
        poly.pollOnce(),
        sol.pollOnce(),
      ]);
      const all = [...ethEvs, ...polyEvs, ...solEvs];
      for (const ev of all) {
        await minter.enqueue(ev, ev.stellarDest);
      }
      await stellarW.pollOnce();
      const res = await minter.processPending();
      if (res.minted > 0 || res.failed > 0) {
        logger.info(res, "mint cycle complete");
      }
    } catch (err) {
      logger.error({ err }, "tick failed");
    }
  };

  await tick();
  intervalId = setInterval(tick, config.POLL_INTERVAL_MS);
  startHealthServer();

  // H9 FIX: Graceful shutdown on SIGTERM/SIGINT.
  // Prevents losing in-flight mints when K8s evicts the pod.
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "received shutdown signal, draining...");
    running = false;
    if (intervalId) clearInterval(intervalId);
    // Allow the current tick to finish, then disconnect DB.
    await new Promise((r) => setTimeout(r, 5_000));
    await prisma.$disconnect();
    logger.info("bridge shut down cleanly");
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "fatal");
  process.exit(1);
});
