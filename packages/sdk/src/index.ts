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

/**
 * Validates the structure and cryptographic integrity of a dual-state proof.
 * 
 * @param proof - The dual-state proof to validate
 * @returns Promise resolving to validation result with errors and warnings
 * @throws Never throws; returns errors in ValidationResult instead
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

/**
 * Validates a quantum stream proof for cryptographic integrity.
 * 
 * @param proof - The quantum stream proof to validate
 * @returns Promise resolving to validation result
 */
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

/**
 * Validates a payment stream for correctness and realistic constraints.
 * Checks timestamps, rates, amounts, and settlement progress.
 * 
 * @param stream - The stream to validate
 * @returns Validation result with any errors or warnings found
 * 
 * @example
 * const stream = createStream(to, rate, start, end);
 * const result = validateStream(stream);
 * if (!result.valid) console.error(result.errors);
 */
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

/**
 * Calculates the amount of funds that have flowed through a stream up to the current time.
 * Returns 0 if stream hasn't started, total if it has ended.
 * 
 * @param stream - The stream to calculate flow for
 * @param currentTime - Current time in seconds (typically Date.now() / 1000)
 * @returns Amount of funds flowed as bigint
 */
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

/**
 * Calculates the remaining funds in a stream that haven't flowed yet.
 * 
 * @param stream - The stream to check
 * @param currentTime - Current time in seconds
 * @returns Remaining funds as bigint
 */
export function calculateRemainingFlow(stream: Stream, currentTime: number): bigint {
  const total = calculateStreamFlow(stream, Number(stream.end));
  const flowed = calculateStreamFlow(stream, currentTime);
  return total - flowed;
}

/**
 * Determines the current status of a stream based on its state and current time.
 * 
 * @param stream - The stream to check
 * @param currentTime - Current time in seconds
 * @returns Stream status enumeration value
 */
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

/**
 * Computes a cryptographic hash of a dual state using Keccak256.
 * 
 * @param state - The dual state to hash
 * @returns Hex string hash (0x prefixed)
 */
export function hashDualState(state: DualState): string {
  const data = `${state.state0}:${state.state1}:${state.createdAt}`;
  return ethers.keccak256(ethers.toUtf8Bytes(data));
}

/**
 * Creates a hybrid proof combining dual-state and stream proofs.
 * 
 * @param dualStateProof - The dual-state proof component
 * @param streamProof - The stream proof component
 * @returns Combined hybrid proof with merged signals
 */
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

/**
 * Validates a hybrid proof by checking both component proofs.
 * 
 * @param proof - The hybrid proof to validate
 * @returns Validation result
 */
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

/**
 * Estimates the total cost of a payment stream.
 * 
 * @param ratePerSecond - Payment rate in base units per second
 * @param durationSeconds - Stream duration in seconds
 * @returns Total cost as bigint
 */
export function estimateStreamCost(
  ratePerSecond: bigint,
  durationSeconds: bigint,
): bigint {
  return ratePerSecond * durationSeconds;
}

/**
 * Estimates the number of settlement proofs needed for a batch of streams.
 * Calculates merkle tree depth based on stream count.
 * 
 * @param numberOfStreams - Total number of streams in batch
 * @returns Estimated proof count (log2 of stream count + 1)
 */
export function estimateSettlementProofs(numberOfStreams: number): number {
  return Math.ceil(Math.log2(numberOfStreams)) + 1;
}

/**
 * Validates multiple proofs in parallel.
 * 
 * @param proofs - Array of proofs to validate
 * @returns Array of validation results
 */
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

/**
 * Submits a batch of dual-state transitions to the contract.
 * 
 * @param batch - The dual state batch to submit
 * @param signer - Signer to use for transaction
 * @param engineAddress - Address of dual-state engine contract
 * @returns Transaction hash
 * @throws If batch is invalid or transaction fails
 */
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

export function isStreamActive(stream: Stream, currentTime: number): boolean {
  const current = BigInt(currentTime);
  return current >= stream.start && current < stream.end && !stream.paused;
}

export function getStreamProgress(stream: Stream, currentTime: number): number {
  const current = BigInt(currentTime);
  const duration = stream.end - stream.start;
  
  if (current <= stream.start) return 0;
  if (current >= stream.end) return 100;
  
  const elapsed = current - stream.start;
  return Math.round((Number(elapsed) / Number(duration)) * 100);
}

export function formatStreamAmount(amount: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${fractionalStr}`;
}

export function parseStreamAmount(amount: string, decimals: number = 18): bigint {
  const [integerStr, fractionalStr = "0"] = amount.split(".");
  const integer = BigInt(integerStr || "0");
  const fractional = BigInt(fractionalStr.padEnd(decimals, "0").slice(0, decimals));
  return integer * BigInt(10 ** decimals) + fractional;
}

