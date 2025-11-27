import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

import { DualStateEngine, QStreamPayments, SyndualToken } from "../typechain-types";

describe("SynDual Contracts", function () {
  let token: SyndualToken;
  let engine: DualStateEngine;
  let payments: QStreamPayments;
  let owner: any;
  let alice: any;
  let bob: any;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("SyndualToken");
    token = (await Token.deploy(owner.address)) as SyndualToken;

    const Engine = await ethers.getContractFactory("DualStateEngine");
    engine = (await Engine.deploy(owner.address)) as DualStateEngine;

    const Payments = await ethers.getContractFactory("QStreamPayments");
    payments = (await Payments.deploy(token.getAddress())) as QStreamPayments;
  });

  it("mints tokens", async () => {
    const amount = ethers.parseEther("100");
    await token.connect(owner).mint(alice.address, amount);
    const balance = await token.balanceOf(alice.address);
    expect(balance).to.equal(amount);
  });

  it("sets and finalizes dual state", async () => {
    const key = ethers.keccak256(ethers.toUtf8Bytes("dual-key-1"));
    const state0 = ethers.keccak256(ethers.toUtf8Bytes("state0"));
    const state1 = ethers.keccak256(ethers.toUtf8Bytes("state1"));

    await engine.connect(owner).setDualState(key, state0, state1);
    const ds = await engine.getDualState(key);
    expect(ds.state0).to.equal(state0);
    expect(ds.state1).to.equal(state1);

    const chosen = await engine.finalizeState(key, 1);
    expect(chosen).to.equal(state1);
  });

  it("creates a stream and withdraws", async () => {
    const mintAmount = ethers.parseEther("1000");
    await token.connect(owner).mint(alice.address, mintAmount);
    await token.connect(alice).approve(await payments.getAddress(), mintAmount);

    const now = await time.latest();
    const start = now + 10n;
    const end = start + 100n;
    const ratePerSecond = 1_000_000_000_000_000n; // 0.001 Sdual/sec if decimals=18

    await payments.connect(alice).createStream(bob.address, ratePerSecond, Number(start), Number(end));
    const streamId = 0n;

    await time.increaseTo(start + 50n);

    const withdrawable = await payments.getWithdrawable(streamId);
    expect(withdrawable).to.equal(ratePerSecond * 50n);

    const before = await token.balanceOf(bob.address);
    await payments.connect(bob).withdraw(streamId);
    const after = await token.balanceOf(bob.address);

    expect(after - before).to.equal(ratePerSecond * 50n);
  });
});
