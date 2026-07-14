import { describe, it, expect } from "vitest";
import { OpenLend } from "../src/index.js";

describe("OpenLend SDK", () => {
  it("constructs with a valid config", () => {
    const o = new OpenLend({
      stellar: {
        rpc: "https://horizon-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
        controllerContract: "CABC",
        secretKey: "SDR4C2CKNCVK4DWMTNI2IXFJ6BE3A6J3WVNCGR6Q3SCMJDTSVHMJGC6U",
      },
      evm: {
        ethereum: { rpc: "https://eth.llamarpc.com", bridgeAddress: "0x0000000000000000000000000000000000000000" },
      },
      api: "http://localhost:4000",
    });
    expect(o.stellar.publicKey).toMatch(/^G[A-Z2-7]+$/);
  });
});
