import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// `@openzeppelin/hardhat-upgrades` adds `upgrades.deployProxy` /
// `upgrades.upgradeProxy` / `upgrades.manifest` so the upgradeable
// `Bridge` contract (which uses `_disableInitializers()` in its
// constructor) can be tested against an ERC-1967 proxy instead of
// being initialised directly on the implementation. Without this
// plugin, `bridge.initialize(...)` in the test fixture reverts with
// OZ 5.x's `InvalidInitialization()`.
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PK = process.env.DEPLOYER_PK ?? "";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC ?? "https://rpc.sepolia.org";
const MUMBAI_RPC = process.env.MUMBAI_RPC ?? "https://rpc-mumbai.maticvigil.com";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      // OZ 5.x uses the `mcopy` opcode (EIP-5656, part of the Cancun
      // EVM upgrade, Solidity 0.8.24+). Hardhat defaults `evmVersion`
      // to the compiler's pre-Cancun value, which causes
      // "DeclarationError: Function 'mcopy' not found" at compile time.
      // Cancun is live on all target chains (Ethereum mainnet, Sepolia,
      // Polygon mainnet, Polygon Mumbai), so set it explicitly. With
      // Cancun we can also adopt `ReentrancyGuardTransient` (EIP-1153)
      // — see TODO in Bridge.sol — and drop back to "shanghai" only if
      // we need to support a pre-Cancun chain.
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC,
      accounts: [DEPLOYER_PK],
      chainId: 11155111,
    },
    mumbai: {
      url: MUMBAI_RPC,
      accounts: [DEPLOYER_PK],
      chainId: 80001,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY ?? "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY ?? "",
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    currency: "USD",
  },
};

export default config;
