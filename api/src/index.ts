import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { marketsRoutes } from "./routes/markets.js";
import { positionsRoutes } from "./routes/positions.js";
import { quoteRoutes } from "./routes/quote.js";
import { eventsRoutes } from "./routes/events.js";
import { attachWebsocket } from "./stream.js";

/**
 * Build a fully-configured Fastify instance WITHOUT calling `.listen()`.
 *
 * This is the testable surface of the API: the integration test suite
 * imports `buildApp`, calls it, and uses `app.inject()` to issue
 * in-process requests (no real port, no port collisions in CI).
 *
 * Production code in `main()` calls `buildApp()` and then `app.listen()`.
 *
 * @param opts.corsOrigin  Override the CORS origin. Defaults to `*` for
 *                         tests (we don't need browser CORS for
 *                         `app.inject()`). Pass an array of origins in
 *                         production via the `CORS_ORIGINS` env var.
 * @param opts.logger      Pass `false` for tests to silence pino output.
 *                         Pass `{ level: ... }` (or `true`) for prod.
 */
export async function buildApp(opts: {
  corsOrigin?: string | string[] | true;
  logger?: boolean | object;
} = {}) {
  const app = Fastify({ logger: opts.logger ?? { level: config.LOG_LEVEL } });
  const origin = opts.corsOrigin ?? (config.CORS_ORIGINS === "*" ? true : config.CORS_ORIGINS.split(","));
  await app.register(cors, { origin });

  app.get("/health", async () => ({ ok: true, service: "openlend-api" }));

  await app.register(marketsRoutes);
  await app.register(positionsRoutes);
  await app.register(quoteRoutes);
  await app.register(eventsRoutes);

  attachWebsocket(app);

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`🚀 OpenLend API listening on :${config.PORT}`);
}

// Only run `main()` when this file is the process entrypoint. Without
// this guard, importing `buildApp` from a test would start a real
// server on `config.PORT` (default 4000), colliding with any other
// process on that port and tripping EADDRINUSE.
//
// `import.meta.main` is the canonical ESM entrypoint check (Node
// 20.11+). The project pins `node ^20.14`, so this is always
// available. An earlier attempt used
//   `import.meta.url === fileURLToPath(import.meta.url).href`
// which is a bug: `fileURLToPath` returns a string, so `.href` is
// `undefined` and the condition is always false (production `main()`
// was dead code; `npm start` would exit silently).
if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
