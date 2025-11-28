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

/**
 * Checks if a stream is currently active (not paused, within time window).
 * 
 * @param stream - The stream to check
 * @param currentTime - Current time in seconds
 * @returns True if stream is active
 */
export function isStreamActive(stream: Stream, currentTime: number): boolean {
  const current = BigInt(currentTime);
  return current >= stream.start && current < stream.end && !stream.paused;
}

/**
 * Calculates the progress percentage of a stream.
 * 
 * @param stream - The stream to check
 * @param currentTime - Current time in seconds
 * @returns Progress as percentage (0-100)
 */
export function getStreamProgress(stream: Stream, currentTime: number): number {
  const current = BigInt(currentTime);
  const duration = stream.end - stream.start;
  
  if (current <= stream.start) return 0;
  if (current >= stream.end) return 100;
  
  const elapsed = current - stream.start;
  return Math.round((Number(elapsed) / Number(duration)) * 100);
}

/**
 * Formats a bigint amount to a human-readable decimal string.
 * 
 * @param amount - Amount as bigint
 * @param decimals - Number of decimal places (default 18)
 * @returns Formatted string with decimals
 * 
 * @example
 * formatStreamAmount(1500000000000000000n, 18) // "1.5"
 */
export function formatStreamAmount(amount: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${fractionalStr}`;
}

/**
 * Parses a decimal string to bigint with specified decimal places.
 * 
 * @param amount - Amount as decimal string
 * @param decimals - Number of decimal places (default 18)
 * @returns Amount as bigint
 * 
 * @example
 * parseStreamAmount("1.5", 18) // 1500000000000000000n
 */
export function parseStreamAmount(amount: string, decimals: number = 18): bigint {
  const [integerStr, fractionalStr = "0"] = amount.split(".");
  const integer = BigInt(integerStr || "0");
  const fractional = BigInt(fractionalStr.padEnd(decimals, "0").slice(0, decimals));
  return integer * BigInt(10 ** decimals) + fractional;
}

// ==================== Account Management ====================

/**
 * Account state tracker with nonce management
 */
export class AccountManager {
  private accounts: Map<string, Account> = new Map();

  /**
   * Creates or retrieves account info
   */
  getAccount(address: string): Account {
    if (!this.accounts.has(address)) {
      this.accounts.set(address, {
        address,
        nonce: 0,
        balance: 0n,
        streamsActive: 0,
        totalStreamed: 0n,
        reputation: 100,
      });
    }
    return this.accounts.get(address)!;
  }

  /**
   * Updates account balance
   */
  updateBalance(address: string, balance: bigint): void {
    const account = this.getAccount(address);
    account.balance = balance;
  }

  /**
   * Increments nonce for transaction management
   */
  incrementNonce(address: string): number {
    const account = this.getAccount(address);
    return ++account.nonce;
  }

  /**
   * Updates active streams count
   */
  updateActiveStreams(address: string, count: number): void {
    const account = this.getAccount(address);
    account.streamsActive = count;
  }

  /**
   * Updates total streamed amount
   */
  updateTotalStreamed(address: string, amount: bigint): void {
    const account = this.getAccount(address);
    account.totalStreamed = amount;
  }

  /**
   * Updates reputation score
   */
  updateReputation(address: string, score: number): void {
    const account = this.getAccount(address);
    account.reputation = Math.max(0, Math.min(100, score));
  }

  /**
   * Gets all tracked accounts
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }
}

// ==================== Stream Management ====================

/**
 * Stream state tracker and manager
 */
export class StreamManager {
  private streams: Map<string, Stream & { id: string; status: StreamStatus }> = new Map();
  private streamsByUser: Map<string, string[]> = new Map();

  /**
   * Creates or retrieves a stream
   */
  getStream(streamId: string): (Stream & { id: string; status: StreamStatus }) | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Registers a new stream
   */
  createStream(streamId: string, stream: Stream): void {
    this.streams.set(streamId, {
      ...stream,
      id: streamId,
      status: StreamStatus.ACTIVE,
    });

    // Index by user
    for (const user of [stream.from, stream.to]) {
      if (!this.streamsByUser.has(user)) {
        this.streamsByUser.set(user, []);
      }
      this.streamsByUser.get(user)!.push(streamId);
    }
  }

  /**
   * Updates stream status
   */
  updateStreamStatus(streamId: string, status: StreamStatus): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.status = status;
    }
  }

  /**
   * Updates settlement amount
   */
  updateSettlement(streamId: string, settledAmount: bigint): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.settled = settledAmount;
    }
  }

  /**
   * Gets streams for a user (as sender or receiver)
   */
  getUserStreams(address: string): (Stream & { id: string; status: StreamStatus })[] {
    const ids = this.streamsByUser.get(address) || [];
    return ids.map((id) => this.streams.get(id)!).filter(Boolean);
  }

  /**
   * Gets active streams for a user
   */
  getActiveStreams(address: string): (Stream & { id: string; status: StreamStatus })[] {
    return this.getUserStreams(address).filter((s) => s.status === StreamStatus.ACTIVE);
  }

  /**
   * Gets all streams
   */
  getAllStreams(): (Stream & { id: string; status: StreamStatus })[] {
    return Array.from(this.streams.values());
  }

  /**
   * Deletes a stream from tracking
   */
  deleteStream(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream) return false;

    this.streams.delete(streamId);

    // Remove from user indices
    for (const user of [stream.from, stream.to]) {
      const ids = this.streamsByUser.get(user);
      if (ids) {
        const idx = ids.indexOf(streamId);
        if (idx >= 0) {
          ids.splice(idx, 1);
        }
      }
    }

    return true;
  }

  /**
   * Calculates statistics for streams
   */
  getStreamStats(): {
    totalStreams: number;
    activeStreams: number;
    totalValue: bigint;
    totalSettled: bigint;
  } {
    const all = this.getAllStreams();
    const active = all.filter((s) => s.status === StreamStatus.ACTIVE);
    const totalValue = all.reduce((sum, s) => sum + (s.total || 0n), 0n);
    const totalSettled = all.reduce((sum, s) => sum + (s.settled || 0n), 0n);

    return {
      totalStreams: all.length,
      activeStreams: active.length,
      totalValue,
      totalSettled,
    };
  }
}

// ==================== Batch Stream Operations ====================

/**
 * Batch operation manager for streams
 */
export class BatchStreamManager {
  /**
   * Validates multiple streams before batch operation
   */
  validateBatch(streams: Stream[]): ValidationResult {
    const errors: string[] = [];

    if (streams.length === 0) {
      errors.push("Batch is empty");
    }

    if (streams.length > 1000) {
      errors.push("Batch size exceeds 1000 streams");
    }

    for (let i = 0; i < streams.length; i++) {
      const result = validateStream(streams[i]);
      if (!result.valid && result.errors) {
        errors.push(`Stream ${i}: ${result.errors.join(", ")}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Calculates total batch value
   */
  calculateBatchValue(streams: Stream[]): bigint {
    return streams.reduce((sum, stream) => {
      const total = stream.ratePerSecond * (stream.end - stream.start);
      return sum + total;
    }, 0n);
  }

  /**
   * Groups streams by sender
   */
  groupBySender(streams: Stream[]): Map<string, Stream[]> {
    const groups = new Map<string, Stream[]>();

    for (const stream of streams) {
      if (!groups.has(stream.from)) {
        groups.set(stream.from, []);
      }
      groups.get(stream.from)!.push(stream);
    }

    return groups;
  }

  /**
   * Groups streams by receiver
   */
  groupByReceiver(streams: Stream[]): Map<string, Stream[]> {
    const groups = new Map<string, Stream[]>();

    for (const stream of streams) {
      if (!groups.has(stream.to)) {
        groups.set(stream.to, []);
      }
      groups.get(stream.to)!.push(stream);
    }

    return groups;
  }
}

// ==================== Package Version & Info ====================

export const SDK_VERSION = "1.0.0";
export const SDK_NAME = "syndual-sdk";

export const sdkInfo = {
  name: SDK_NAME,
  version: SDK_VERSION,
  description: "Syndual Protocol SDK - Zero-Knowledge Dual-State and QStream Payments",
  features: [
    "Dual-state cryptography with ZK proofs",
    "Quantum-inspired payment streams",
    "Hybrid proof generation and verification",
    "Account and stream lifecycle management",
    "Comprehensive caching and metrics",
    "Error recovery and retry mechanisms",
  ],
};
