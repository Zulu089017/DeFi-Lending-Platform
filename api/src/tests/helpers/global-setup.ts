import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Vitest globalSetup. Runs once before any test file.
 *
 *   1. Verifies that a working Docker daemon is reachable. Surfaces a
 *      clear, actionable error in CI / DinD environments where the
 *      default `/var/run/docker.sock` is missing.
 *   2. Spins up a real Postgres in Docker via testcontainers.
 *   3. Pushes the Prisma schema into the fresh database.
 *   4. Sets `DATABASE_URL` (plus dummy Stellar config) so the
 *      singleton `new PrismaClient()` in `src/db.ts` connects to the
 *      test DB. Vitest's fork pool inherits these env vars to workers.
 *
 * The returned function runs once after all test files complete and
 * stops the container.
 */
export async function setup(): Promise<() => Promise<void>> {
  // Step 1: fail fast with a clear message if Docker isn't reachable.
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    throw new Error(
      "[api tests] Docker daemon is not reachable. The integration suite " +
        "needs testcontainers to start a Postgres container. In a CI " +
        "runner, mount `/var/run/docker.sock` (DinD) or set DOCKER_HOST. " +
        "Locally, ensure `docker info` succeeds before running `vitest`.",
    );
  }

  // Step 2: start the container.
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:16-alpine",
  )
    .withDatabase("openlend_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  // `config.ts` Zod-parses the env at module load; supply the Stellar
  // fields with dummy values (the routes under test never read them).
  process.env.STELLAR_RPC ??= "https://stellar.test";
  process.env.STELLAR_NETWORK_PASSPHRASE ??= "Test SDF Network ; September 2015";
  process.env.STELLAR_CONTROLLER ??= "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Step 3: materialise the schema. `db push` is faster than running
  // migrations and doesn't require the indexer's migration history.
  // `--skip-generate` because the client was already generated.
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  // Step 4: teardown.
  return async () => {
    await container.stop();
  };
}
