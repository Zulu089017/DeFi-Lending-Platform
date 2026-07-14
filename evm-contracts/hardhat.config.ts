import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
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
