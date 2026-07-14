/**
 * Vitest setupFile. Runs in each worker process before the test file is
 * imported. Asserts that `globalSetup` successfully propagated the
 * test-database env vars; without this guard, a propagation failure
 * would surface deep inside `db.ts` as a confusing "DATABASE_URL is
 * not set" error from `config.ts`.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    "[api tests] DATABASE_URL is not set. This usually means the vitest " +
      "fork pool did not inherit env vars from globalSetup. Check that " +
      "`src/tests/helpers/global-setup.ts` ran before this file and that " +
      "you are not running `vitest` with `--no-env` or a custom env filter.",
  );
}
