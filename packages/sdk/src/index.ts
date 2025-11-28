import { Contract, Provider, Signer, ethers } from "ethers";
import {
  ContractAddresses,
  DualState,
  DualStateProof,
  QStreamProof,
  Stream,
  HybridProof,
  StreamStatus,
  ValidationResult,
  OperationStatus,
  StreamSettlement,
  Account,
  ProofType,
  DualStateBatch,
} from "@syndual/core-types";
import {
  generateDualStateProof,
  generateQStreamProof,
  verifyDualStateProof,
  verifyQStreamProof,
  HybridProver,
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

/**
 * Utility functions for proof validation and stream operations
 */

export async function validateDualStateProof(proof: DualStateProof): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!proof.proof || proof.proof.length === 0) {
    errors.push("Proof field is empty");
  }
  
  if (!proof.publicSignals || proof.publicSignals.length === 0) {
    errors.push("Public signals are missing");
  }
  
  if (proof.publicSignals.length < 2) {
    errors.push("Expected at least 2 public signals for dual state");
  }
  
  const isValid = await verifyDualStateProof(proof);
  if (!isValid) {
    errors.push("Proof verification failed");
  }
  
  if (proof.timestamp && proof.timestamp > Date.now()) {
    warnings.push("Proof timestamp is in the future");
  }
  
  return {
    valid: errors.length === 0 && isValid,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export async function validateQStreamProof(proof: QStreamProof): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!proof.proof || proof.proof.length === 0) {
    errors.push("Proof field is empty");
  }
  
  if (!proof.publicSignals || proof.publicSignals.length === 0) {
    errors.push("Public signals are missing");
  }
  
  const isValid = await verifyQStreamProof(proof);
  if (!isValid) {
    errors.push("Proof verification failed");
  }
  
  if (proof.timestamp && proof.timestamp > Date.now()) {
    warnings.push("Proof timestamp is in the future");
  }
  
  return {
    valid: errors.length === 0 && isValid,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function validateStream(stream: Stream): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!stream.from || stream.from.length === 0) {
    errors.push("Stream 'from' address is required");
  }
  
  if (!stream.to || stream.to.length === 0) {
    errors.push("Stream 'to' address is required");
  }
  
  if (stream.ratePerSecond <= 0n) {
    errors.push("Rate per second must be positive");
  }
  
  if (stream.start >= stream.end) {
    errors.push("Stream start time must be before end time");
  }
  
  if (stream.start < 0n || stream.end < 0n) {
    errors.push("Stream times must be non-negative");
  }
  
  const duration = stream.end - stream.start;
  const total = stream.ratePerSecond * duration;
  
  if (stream.total && stream.total !== total) {
    warnings.push("Total amount does not match rate * duration");
  }
  
  if (stream.settled && stream.settled > (stream.total || total)) {
    errors.push("Settled amount exceeds total");
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function calculateStreamFlow(stream: Stream, currentTime: number): bigint {
  const current = BigInt(currentTime);
  
  if (current < stream.start) {
    return 0n;
  }
  
  if (current >= stream.end) {
    return stream.ratePerSecond * BigInt(stream.end - stream.start);
  }
  
  return stream.ratePerSecond * (current - stream.start);
}

export function calculateRemainingFlow(stream: Stream, currentTime: number): bigint {
  const total = calculateStreamFlow(stream, Number(stream.end));
  const flowed = calculateStreamFlow(stream, currentTime);
  return total - flowed;
}

export function getStreamStatus(stream: Stream, currentTime: number): StreamStatus {
  const current = BigInt(currentTime);
  
  if (current < stream.start) {
    return StreamStatus.ACTIVE;
  }
  
  if (current >= stream.end) {
    const totalAmount = stream.ratePerSecond * (stream.end - stream.start);
    if (stream.settled === totalAmount) {
      return StreamStatus.SETTLED;
    }
    return StreamStatus.EXPIRED;
  }
  
  return StreamStatus.ACTIVE;
}

export function hashDualState(state: DualState): string {
  const data = `${state.state0}:${state.state1}:${state.createdAt}`;
  return ethers.keccak256(ethers.toBeHex(data));
}

export function createHybridProof(
  dualStateProof: DualStateProof,
  streamProof: QStreamProof,
): HybridProof {
  const combinedSignals = [
    ...dualStateProof.publicSignals,
    ...streamProof.publicSignals,
  ];
  
  return {
    id: ethers.id(JSON.stringify(combinedSignals)),
    dualStateProof,
    streamProof,
    combinedSignals,
    timestamp: Date.now(),
    verified: (dualStateProof.verified ?? false) && (streamProof.verified ?? false),
  };
}

export async function validateHybridProof(proof: HybridProof): Promise<ValidationResult> {
  const errors: string[] = [];
  
  if (!proof.id) {
    errors.push("Hybrid proof ID is missing");
  }
  
  if (!proof.dualStateProof) {
    errors.push("Dual state proof is missing");
  } else {
    const dsResult = await validateDualStateProof(proof.dualStateProof);
    if (!dsResult.valid && dsResult.errors) {
      errors.push(`Dual state proof invalid: ${dsResult.errors.join(", ")}`);
    }
  }
  
  if (!proof.streamProof) {
    errors.push("Stream proof is missing");
  } else {
    const streamResult = await validateQStreamProof(proof.streamProof);
    if (!streamResult.valid && streamResult.errors) {
      errors.push(`Stream proof invalid: ${streamResult.errors.join(", ")}`);
    }
  }
  
  if (!proof.combinedSignals || proof.combinedSignals.length === 0) {
    errors.push("Combined signals are missing");
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    verified: proof.verified,
  };
}

export function estimateStreamCost(
  ratePerSecond: bigint,
  durationSeconds: bigint,
): bigint {
  return ratePerSecond * durationSeconds;
}

export function estimateSettlementProofs(numberOfStreams: number): number {
  return Math.ceil(Math.log2(numberOfStreams)) + 1;
}

export async function batchValidateProofs(
  proofs: (DualStateProof | QStreamProof)[],
): Promise<ValidationResult[]> {
  return Promise.all(
    proofs.map(async (proof) => {
      if ("from" in (proof as any)) {
        return validateQStreamProof(proof as QStreamProof);
      }
      return validateDualStateProof(proof as DualStateProof);
    }),
  );
}

export async function submitDualStateBatch(
  batch: DualStateBatch,
  signer: Signer,
  engineAddress: string,
): Promise<string> {
  const contract = new Contract(
    engineAddress,
    DUAL_STATE_ENGINE_ABI,
    signer,
  );

  const tx = await contract.batchSetDualStates(
    batch.states.map((s: DualState) => ({ state0: s.state0, state1: s.state1 })),
  );

  const receipt = await tx.wait();
  return receipt?.hash || "";
}
