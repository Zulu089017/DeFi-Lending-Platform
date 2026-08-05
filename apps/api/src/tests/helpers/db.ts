import { prisma } from "../../db.js";

/**
 * Wipe every event table the API reads. Call from `beforeEach` to give
 * each test a clean slate without paying the cost of recreating the
 * schema or restarting the container.
 */
export async function resetDb(): Promise<void> {
  // Order matters only for foreign keys; the schema has no FKs between
  // these tables, so any order is fine.
  await prisma.lendingEvent.deleteMany();
  await prisma.wrapEvent.deleteMany();
  await prisma.unwrapEvent.deleteMany();
  await prisma.bridgeEvent.deleteMany();
}
