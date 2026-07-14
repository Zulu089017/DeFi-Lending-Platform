import { ethers, network, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with ${deployer.address} on ${network.name}`);

  // The proxy admin and the contract owner are both set to the deployer
  // by default. For a production deployment, set `PROXY_ADMIN_ADDRESS` to
  // a Gnosis Safe (or another multisig) and `OWNER_ADDRESS` to the
  // governance multisig. Failing to do so means a single compromised
  // deployer key can upgrade or pause the bridge.
  const proxyAdmin = process.env.PROXY_ADMIN_ADDRESS ?? deployer.address;
  const owner = process.env.OWNER_ADDRESS ?? deployer.address;
  if (network.name !== "hardhat" && proxyAdmin === deployer.address) {
    console.warn(`  WARNING: PROXY_ADMIN_ADDRESS not set; using deployer EOA (${deployer.address}). Set it to a multisig for production.`);
  }
  if (network.name !== "hardhat" && owner === deployer.address) {
    console.warn(`  WARNING: OWNER_ADDRESS not set; using deployer EOA (${deployer.address}). Set it to a multisig for production.`);
  }

  // 1. Wrapped token (canonical on this chain)
  const Token = await ethers.getContractFactory("WrappedToken");
  const token = await Token.deploy("OpenLend Test", "oTST", ethers.parseEther("1000000"), owner);
  await token.waitForDeployment();
  console.log(`  WrappedToken: ${await token.getAddress()}`);

  // 2. Bridge with 2-of-3 attester quorum (use deployer + 2 random
  // signers as placeholders). OZ 5.x's `_disableInitializers()`
  // permanently disables `initialize()` on the implementation, so we
  // deploy via the OZ upgrades plugin's `deployProxy` helper, which
  // deploys the impl + an ERC-1967 proxy + atomically calls
  // `initialize(attesters, threshold)`. The proxy admin is set to
  // `proxyAdmin` (a multisig in production).
  const attesters = [deployer.address, ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address];
  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await upgrades.deployProxy(
    Bridge,
    [attesters, 2],
    {
      initializer: "initialize",
      unsafeAllow: ["constructor"], // explicit acknowledgement of the
                                    // `_disableInitializers()` constructor
      unsafeAllowLinkedLibraries: false,
    },
  );
  await bridge.waitForDeployment();
  // Transfer ownership from the deployer (initial owner is `msg.sender`
  // of `__Ownable_init`, which inside `deployProxy` is the deployProxy
  // caller) to the configured `owner` multisig.
  if (owner !== deployer.address) {
    const bridgeAsOwner = await ethers.getContractAt("Bridge", await bridge.getAddress(), deployer);
    await bridgeAsOwner.transferOwnership(owner);
  }
  // Transfer the ERC-1967 proxy admin (the address that can call
  // `upgradeTo` / `upgradeToAndCall` on the proxy) from the deployer
  // EOA to the configured `proxyAdmin` multisig. Without this, a
  // single compromised deployer key could still upgrade the impl.
  if (proxyAdmin !== deployer.address) {
    await upgrades.admin.transferProxyAdminOwnership(proxyAdmin);
  }
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
