import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge", () => {
  async function deploy() {
    const [owner, user, attester1, attester2, attester3] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("WrappedToken");
    const token = await Token.deploy("Test", "TST", ethers.parseEther("1000000"), owner.address);
    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.deploy();
    await bridge.initialize([attester1.address, attester2.address, attester3.address], 2);
    await bridge.setTokenConfig(
      await token.getAddress(),
      true,
      ethers.parseEther("0.01"),
      ethers.parseEther("10000"),
    );
    await token.transfer(user.address, ethers.parseEther("1000"));
    await token.connect(user).approve(await bridge.getAddress(), ethers.parseEther("1000"));
    return { owner, user, attester1, attester2, attester3, token, bridge };
  }

  it("locks tokens and emits Locked", async () => {
    const { user, token, bridge } = await deploy();
    const stellarDest = ethers.hexlify(ethers.randomBytes(32));
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther("100");

    // Compute the expected nonce off-chain rather than using staticCall inside
    // withArgs (which would mix the awaited value into the arg list).
    const expectedNonce = ethers.keccak256(
      ethers.solidityPackedKeccak256(
        ["address", "address", "uint256", "bytes32", "uint256"],
        [user.address, await token.getAddress(), amount, salt, (await ethers.provider.getNetwork()).chainId],
      ),
    );

    await expect(bridge.connect(user).lock(await token.getAddress(), amount, stellarDest, salt))
      .to.emit(bridge, "Locked")
      .withArgs(user.address, await token.getAddress(), amount, stellarDest, salt, expectedNonce);
  });

  it("rejects reused salt", async () => {
    const { user, token, bridge } = await deploy();
    const stellarDest = ethers.hexlify(ethers.randomBytes(32));
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const amount = ethers.parseEther("10");

    await bridge.connect(user).lock(await token.getAddress(), amount, stellarDest, salt);
    await expect(
      bridge.connect(user).lock(await token.getAddress(), amount, stellarDest, salt),
    ).to.be.revertedWith("Bridge: salt reused");
  });

  it("rejects amount below min", async () => {
    const { user, token, bridge } = await deploy();
    const stellarDest = ethers.hexlify(ethers.randomBytes(32));
    const salt = ethers.hexlify(ethers.randomBytes(32));
    await expect(
      bridge.connect(user).lock(await token.getAddress(), 1n, stellarDest, salt),
    ).to.be.revertedWith("Bridge: amount out of range");
  });

  it("rejects when paused", async () => {
    const { owner, user, token, bridge } = await deploy();
    await bridge.connect(owner).setPaused(true);
    const stellarDest = ethers.hexlify(ethers.randomBytes(32));
    const salt = ethers.hexlify(ethers.randomBytes(32));
    await expect(
      bridge.connect(user).lock(await token.getAddress(), ethers.parseEther("10"), stellarDest, salt),
    ).to.be.reverted;
  });
});
