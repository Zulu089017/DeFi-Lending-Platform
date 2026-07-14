import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function eventsRoutes(app: FastifyInstance) {
  app.get("/v1/wrap-events", async () => {
    return prisma.wrapEvent.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  });

  app.get("/v1/unwrap-events", async () => {
    return prisma.unwrapEvent.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  });

  app.get("/v1/lending-events", async (req) => {
    const q = req.query as { user?: string; asset?: string };
    return prisma.lendingEvent.findMany({
      where: { ...(q.user ? { user: q.user } : {}), ...(q.asset ? { asset: q.asset } : {}) },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
  });
}
