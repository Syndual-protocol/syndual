import { Contract, Provider, Signer, ethers } from "ethers";
import {
  ContractAddresses,
  DualState,
  DualStateProof,
  QStreamProof,
  Stream,
} from "@syndual/core-types";
import {
  generateDualStateProof,
  generateQStreamProof,
  verifyDualStateProof,
  verifyQStreamProof,
} from "@syndual/zk";

const DUAL_STATE_ENGINE_ABI = [
  "function setDualState(bytes32 key, bytes32 state0, bytes32 state1) external",
  "function finalizeState(bytes32 key, uint8 chosenStateIndex) external view returns (bytes32)",
  "function getDualState(bytes32 key) external view returns (bytes32 state0, bytes32 state1, uint64 createdAt)",
];

const QSTREAM_ABI = [
  "function createStream(address to, uint128 ratePerSecond, uint64 start, uint64 end) external returns (uint256)",
  "function getWithdrawable(uint256 streamId) external view returns (uint256)",
  "function withdraw(uint256 streamId) external",
];

export interface SynDualClientConfig {
  provider: Provider;
  signer?: Signer;
  addresses: ContractAddresses;
}

export class SynDualClient {
  private readonly provider: Provider;
  private readonly signer?: Signer;
  private readonly addresses: ContractAddresses;

  constructor(config: SynDualClientConfig) {
    this.provider = config.provider;
    this.signer = config.signer;
    this.addresses = config.addresses;
  }

  private get dualStateEngine(): Contract {
    return new Contract(this.addresses.dualStateEngine, DUAL_STATE_ENGINE_ABI, this.signer ?? this.provider);
  }

  private get qStream(): Contract {
    return new Contract(this.addresses.qStreamPayments, QSTREAM_ABI, this.signer ?? this.provider);
  }

  private requireSigner(): Signer {
    if (!this.signer) {
      throw new Error("Signer is required for this action");
    }
    return this.signer;
  }

  async getDualState(key: string): Promise<DualState> {
    const ds = await this.dualStateEngine.getDualState(key);
    return { state0: ds[0], state1: ds[1], createdAt: ds[2] };
  }

  async setDualState(key: string, state0: string, state1: string) {
    const signer = this.requireSigner();
    const contract = this.dualStateEngine.connect(signer);
    const tx = await contract.setDualState(key, state0, state1);
    return tx.wait();
  }

  async finalizeState(key: string, chosenIndex: number) {
    return this.dualStateEngine.finalizeState(key, chosenIndex);
  }

  async createQStream(to: string, ratePerSecond: bigint, start: number, end: number) {
    const signer = this.requireSigner();
    const contract = this.qStream.connect(signer);
    const tx = await contract.createStream(to, ratePerSecond, start, end);
    const receipt = await tx.wait();
    // TODO: parse emitted event for streamId once topics are known
    return receipt;
  }

  async getWithdrawable(streamId: bigint): Promise<bigint> {
    const result = await this.qStream.getWithdrawable(streamId);
    return BigInt(result);
  }

  async withdrawStream(streamId: bigint) {
    const signer = this.requireSigner();
    const contract = this.qStream.connect(signer);
    const tx = await contract.withdraw(streamId);
    return tx.wait();
  }

  async requestDualStateProof(state0: string, state1: string, selector: 0 | 1): Promise<DualStateProof> {
    const proof = await generateDualStateProof(state0, state1, selector);
    const valid = await verifyDualStateProof(proof);
    if (!valid) {
      throw new Error("Dual state proof invalid");
    }
    return proof;
  }

  async requestQStreamProof(ratePerSecond: bigint, elapsedTime: bigint): Promise<QStreamProof> {
    const proof = await generateQStreamProof(ratePerSecond, elapsedTime);
    const valid = await verifyQStreamProof(proof);
    if (!valid) {
      throw new Error("Q-Stream proof invalid");
    }
    return proof;
  }
}
