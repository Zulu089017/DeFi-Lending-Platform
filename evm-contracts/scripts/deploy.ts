import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with ${deployer.address} on ${network.name}`);

  // 1. Wrapped token (canonical on this chain)
  const Token = await ethers.getContractFactory("WrappedToken");
  const token = await Token.deploy("OpenLend Test", "oTST", ethers.parseEther("1000000"), deployer.address);
  await token.waitForDeployment();
  console.log(`  WrappedToken: ${await token.getAddress()}`);

  // 2. Bridge with 2-of-3 attester quorum (use deployer + 2 random signers as placeholders)
  const attesters = [deployer.address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address];
  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy();
  await bridge.waitForDeployment();
  await bridge.initialize(attesters, 2);
  console.log(`  Bridge:      ${await bridge.getAddress()}`);

  // 3. Configure token
  await bridge.setTokenConfig(
    await token.getAddress(),
    true,
    ethers.parseEther("0.01"),
    ethers.parseEther("100000"),
  );
  console.log(`  Token configured.`);

  // 4. Write manifest (network-specific file under sdk/src/manifests/)
  const outDir = path.join(__dirname, "..", "..", "sdk", "src", "manifests");
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    contracts: {
      bridge: await bridge.getAddress(),
      wrappedToken: await token.getAddress(),
    },
    attesters,
  };
  const file = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));

  // Also merge the chain-specific entry into the main manifest that the SDK
  // imports at build time.
  const mainPath = path.join(__dirname, "..", "..", "sdk", "src", "manifest.json");
  let main: any = {};
  if (fs.existsSync(mainPath)) {
    main = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  }
  main.evm = main.evm ?? {};
  main.evm[network.name] = { bridge: await bridge.getAddress() };
  fs.writeFileSync(mainPath, JSON.stringify(main, null, 2));
  console.log(`  Wrote manifest to ${file} and updated ${mainPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
