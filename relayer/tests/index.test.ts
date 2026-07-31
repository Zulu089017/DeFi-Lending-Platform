import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/config.js", () => ({
  config: { POLL_INTERVAL_MS: 100 },
}));

vi.mock("../src/queue.js", () => ({
  Relayer: vi.fn(() => ({
    processOnce: vi.fn().mockResolvedValue({ submitted: 1, failed: 0 }),
  })),
}));

vi.mock("../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

describe("Relayer module loads without crashing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("exports a basic tick loop concept", async () => {
    await expect(import("../src/index.js")).resolves.toBeDefined();
    vi.useRealTimers();
  });
});
