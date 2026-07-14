import Fastify from "fastify";
import cors from "fastify-cors";
import { config } from "./config.js";
import { marketsRoutes } from "./routes/markets.js";
import { positionsRoutes } from "./routes/positions.js";
import { quoteRoutes } from "./routes/quote.js";
import { eventsRoutes } from "./routes/events.js";
import { attachWebsocket } from "./stream.js";

async function main() {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });
  await app.register(cors, { origin: config.CORS_ORIGINS === "*" ? true : config.CORS_ORIGINS.split(",") });

  app.get("/health", async () => ({ ok: true, service: "openlend-api" }));

  await app.register(marketsRoutes);
  await app.register(positionsRoutes);
  await app.register(quoteRoutes);
  await app.register(eventsRoutes);

  attachWebsocket(app);

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`🚀 OpenLend API listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
