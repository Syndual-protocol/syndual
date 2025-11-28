import { ethers } from "ethers";
import {
  DualState,
  Stream,
  DualStateProof,
  QStreamProof,
  HybridProof,
  Account,
  StreamStatus,
  OperationStatus,
  ProofType,
} from "@syndual/core-types";

/**
 * Test Utilities and Mock Data Generators
 * 
 * Provides factories and utilities for testing and development
 */

// ==================== Random Generators ====================

export function generateRandomAddress(): string {
  return ethers.getAddress(ethers.zeroPadValue(Math.random().toString(36).slice(2), 20));
}

export function generateRandomHash(): string {
  return ethers.id(Math.random().toString());
}

export function generateRandomBigInt(min: bigint = 1n, max: bigint = 10n ** 18n): bigint {
  const range = max - min;
  return min + BigInt(Math.floor(Math.random() * Number(range)));
}

// ==================== Mock Data Factories ====================

export class MockDataFactory {
  /**
   * Creates a mock DualState
   */
  static createDualState(overrides: Partial<DualState> = {}): DualState {
    return {
      state0: generateRandomHash(),
      state1: generateRandomHash(),
      createdAt: Date.now(),
      hash: generateRandomHash(),
      metadata: { source: "test" },
      ...overrides,
    };
  }

  /**
   * Creates a mock Stream
   */
  static createStream(overrides: Partial<Stream> = {}): Stream {
    const now = Math.floor(Date.now() / 1000);
    const duration = 3600; // 1 hour
    const ratePerSecond = generateRandomBigInt(1n, 10n ** 15n);

    return {
      from: generateRandomAddress(),
      to: generateRandomAddress(),
      ratePerSecond,
      start: BigInt(now),
      end: BigInt(now + duration),
      total: ratePerSecond * BigInt(duration),
      settled: 0n,
      ...overrides,
    };
  }

  /**
   * Creates a mock DualStateProof
   */
  static createDualStateProof(overrides: Partial<DualStateProof> = {}): DualStateProof {
    return {
      proof: ethers.hexlify(ethers.randomBytes(256)),
      publicSignals: [
        generateRandomHash(),
        generateRandomHash(),
        generateRandomHash(),
      ],
      timestamp: Date.now(),
      verified: true,
      ...overrides,
    };
  }

  /**
   * Creates a mock QStreamProof
   */
  static createQStreamProof(overrides: Partial<QStreamProof> = {}): QStreamProof {
    return {
      proof: ethers.hexlify(ethers.randomBytes(256)),
      publicSignals: [
        generateRandomBigInt().toString(),
        generateRandomBigInt().toString(),
        generateRandomBigInt().toString(),
      ],
      timestamp: Date.now(),
      verified: true,
      ...overrides,
    };
  }

  /**
   * Creates a mock HybridProof
   */
  static createHybridProof(overrides: Partial<HybridProof> = {}): HybridProof {
    const dualStateProof = this.createDualStateProof();
    const streamProof = this.createQStreamProof();

    return {
      id: ethers.id(`hybrid-${Date.now()}`),
      dualStateProof,
      streamProof,
      combinedSignals: [
        ...dualStateProof.publicSignals,
        ...streamProof.publicSignals,
      ],
      timestamp: Date.now(),
      verified: true,
      ...overrides,
    };
  }

  /**
   * Creates a mock Account
   */
  static createAccount(overrides: Partial<Account> = {}): Account {
    return {
      address: generateRandomAddress(),
      nonce: Math.floor(Math.random() * 1000),
      balance: generateRandomBigInt(),
      streamsActive: Math.floor(Math.random() * 10),
      totalStreamed: generateRandomBigInt(10n ** 15n, 10n ** 18n),
      reputation: Math.floor(Math.random() * 100),
      ...overrides,
    };
  }
}

// ==================== Test Data Sets ====================

export class TestDataSets {
  /**
   * Creates a set of related DualStates for testing state transitions
   */
  static createDualStateSequence(count: number): DualState[] {
    const states: DualState[] = [];
    for (let i = 0; i < count; i++) {
      states.push(
        MockDataFactory.createDualState({
          metadata: { sequenceIndex: i },
        }),
      );
    }
    return states;
  }

  /**
   * Creates a set of streams with various rates and durations
   */
  static createStreamCollection(count: number): Stream[] {
    return Array.from({ length: count }, () => MockDataFactory.createStream());
  }

  /**
   * Creates a realistic batch of proofs for testing
   */
  static createProofBatch(dualStateCount: number, streamCount: number): {
    dualStateProofs: DualStateProof[];
    streamProofs: QStreamProof[];
    hybridProofs: HybridProof[];
  } {
    const dualStateProofs = Array.from({ length: dualStateCount }, () =>
      MockDataFactory.createDualStateProof(),
    );
    const streamProofs = Array.from({ length: streamCount }, () =>
      MockDataFactory.createQStreamProof(),
    );
    const hybridProofs = Array.from(
      { length: Math.min(dualStateCount, streamCount) },
      () => MockDataFactory.createHybridProof(),
    );

    return { dualStateProofs, streamProofs, hybridProofs };
  }

  /**
   * Creates test data with various edge cases
   */
  static createEdgeCaseStreams(): Stream[] {
    const now = Math.floor(Date.now() / 1000);

    return [
      // Very small rate
      MockDataFactory.createStream({
        ratePerSecond: 1n,
        start: BigInt(now),
        end: BigInt(now + 3600),
      }),
      // Very large rate
      MockDataFactory.createStream({
        ratePerSecond: 10n ** 18n,
        start: BigInt(now),
        end: BigInt(now + 3600),
      }),
      // Very short duration
      MockDataFactory.createStream({
        ratePerSecond: 10n ** 15n,
        start: BigInt(now),
        end: BigInt(now + 1),
      }),
      // Very long duration
      MockDataFactory.createStream({
        ratePerSecond: 10n ** 15n,
        start: BigInt(now),
        end: BigInt(now + 31536000), // 1 year
      }),
    ];
  }
}

// ==================== Assertion Helpers ====================

export class ProofAssertions {
  /**
   * Asserts that a proof has valid structure
   */
  static assertValidProofStructure(proof: DualStateProof | QStreamProof): void {
    if (!proof.proof || typeof proof.proof !== "string") {
      throw new Error("Proof must be a non-empty string");
    }

    if (proof.proof.length < 100) {
      throw new Error("Proof appears too short to be valid");
    }

    if (!Array.isArray(proof.publicSignals)) {
      throw new Error("Public signals must be an array");
    }

    if (proof.publicSignals.length === 0) {
      throw new Error("Public signals cannot be empty");
    }
  }

  /**
   * Asserts that a stream is well-formed
   */
  static assertValidStream(stream: Stream): void {
    if (!stream.from || !ethers.isAddress(stream.from)) {
      throw new Error("Invalid 'from' address");
    }

    if (!stream.to || !ethers.isAddress(stream.to)) {
      throw new Error("Invalid 'to' address");
    }

    if (stream.ratePerSecond <= 0n) {
      throw new Error("Rate per second must be positive");
    }

    if (stream.start >= stream.end) {
      throw new Error("Start time must be before end time");
    }

    if (stream.settled && stream.total && stream.settled > stream.total) {
      throw new Error("Settled amount exceeds total");
    }
  }

  /**
   * Asserts that a hybrid proof is properly formed
   */
  static assertValidHybridProof(proof: HybridProof): void {
    if (!proof.id) {
      throw new Error("Hybrid proof must have an ID");
    }

    this.assertValidProofStructure(proof.dualStateProof);
    this.assertValidProofStructure(proof.streamProof);

    if (!Array.isArray(proof.combinedSignals) || proof.combinedSignals.length === 0) {
      throw new Error("Combined signals must be a non-empty array");
    }

    const expectedSignalCount =
      proof.dualStateProof.publicSignals.length +
      proof.streamProof.publicSignals.length;

    if (proof.combinedSignals.length < expectedSignalCount) {
      throw new Error("Combined signals do not include all individual signals");
    }
  }
}

// ==================== Performance Testing ====================

export class PerformanceMetrics {
  private startTime: number = 0;
  private measurements: Map<string, number[]> = new Map();

  /**
   * Starts timing a named operation
   */
  start(label: string): void {
    this.startTime = performance.now();
  }

  /**
   * Ends timing and records the measurement
   */
  end(label: string): number {
    const duration = performance.now() - this.startTime;
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);
    return duration;
  }

  /**
   * Gets statistics for a measurement
   */
  getStats(label: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  } | null {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return null;

    return {
      count: times.length,
      total: times.reduce((a, b) => a + b, 0),
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
    };
  }

  /**
   * Gets all measurements
   */
  getAllStats(): Record<string, ReturnType<this["getStats"]>> {
    const stats: Record<string, ReturnType<this["getStats"]>> = {};
    for (const label of this.measurements.keys()) {
      stats[label] = this.getStats(label);
    }
    return stats;
  }

  /**
   * Resets all measurements
   */
  reset(): void {
    this.measurements.clear();
  }
}

// ==================== Validation Helpers ====================

export class StreamValidators {
  /**
   * Validates a stream against realistic constraints
   */
  static validateRealistic(stream: Stream): string[] {
    const errors: string[] = [];

    // Check for reasonable rate (not absurdly high/low)
    if (stream.ratePerSecond > 10n ** 27n) {
      errors.push("Rate per second exceeds reasonable bounds");
    }

    if (stream.ratePerSecond < 1n) {
      errors.push("Rate per second is less than 1");
    }

    // Check for reasonable duration
    const duration = stream.end - stream.start;
    if (duration > BigInt(365 * 24 * 3600)) {
      errors.push("Stream duration exceeds 1 year");
    }

    if (duration < 1n) {
      errors.push("Stream duration is less than 1 second");
    }

    // Check total matches rate * duration
    const expectedTotal = stream.ratePerSecond * duration;
    if (stream.total && stream.total !== expectedTotal) {
      errors.push("Total amount does not match rate × duration");
    }

    return errors;
  }

  /**
   * Validates settlement is progressing correctly
   */
  static validateSettlement(
    stream: Stream,
    settledAmount: bigint,
    timePassed: number,
  ): string[] {
    const errors: string[] = [];

    const expectedFlow = stream.ratePerSecond * BigInt(timePassed);
    if (settledAmount > expectedFlow) {
      errors.push("Settled amount exceeds expected flow for time passed");
    }

    const maxSettled = stream.ratePerSecond * (stream.end - stream.start);
    if (settledAmount > maxSettled) {
      errors.push("Settled amount exceeds total stream amount");
    }

    return errors;
  }
}

// ==================== State Machine Testers ====================

export class StateMachineValidator {
  /**
   * Validates stream state transitions
   */
  static validateStateTransition(
    fromState: StreamStatus,
    toState: StreamStatus,
  ): boolean {
    const validTransitions: Record<StreamStatus, StreamStatus[]> = {
      [StreamStatus.ACTIVE]: [StreamStatus.PAUSED, StreamStatus.SETTLED, StreamStatus.CANCELLED],
      [StreamStatus.PAUSED]: [StreamStatus.ACTIVE, StreamStatus.CANCELLED],
      [StreamStatus.SETTLED]: [],
      [StreamStatus.CANCELLED]: [],
      [StreamStatus.EXPIRED]: [StreamStatus.WITHDRAWN],
      [StreamStatus.WITHDRAWN]: [],
    };

    return validTransitions[fromState]?.includes(toState) ?? false;
  }

  /**
   * Validates operation status transitions
   */
  static isValidOperationProgress(
    from: OperationStatus,
    to: OperationStatus,
  ): boolean {
    const order = [
      OperationStatus.PENDING,
      OperationStatus.PROCESSING,
      OperationStatus.COMPLETED,
    ];
    const fromIdx = order.indexOf(from);
    const toIdx = order.indexOf(to);

    if (fromIdx === -1 || toIdx === -1) return false;
    return toIdx >= fromIdx || to === OperationStatus.FAILED;
  }
}

// ==================== Constants & Configuration ====================

export const PROTOCOL_CONSTANTS = {
  MIN_STREAM_DURATION: 1, // 1 second
  MAX_STREAM_DURATION: 31536000, // 1 year in seconds
  MIN_RATE_PER_SECOND: 1n,
  MAX_RATE_PER_SECOND: 10n ** 27n,
  DEFAULT_PROOF_TIMEOUT: 30000, // 30 seconds
  MERKLE_TREE_DEPTH: 16,
  MAX_BATCH_SIZE: 100,
  DEFAULT_DECIMALS: 18,
};

export const PROOF_THRESHOLDS = {
  MIN_SIGNALS: 2,
  MIN_PROOF_SIZE: 100,
  MAX_PROOF_SIZE: 10240,
  SIGNAL_VALIDITY_WINDOW: 3600000, // 1 hour
};

// ==================== Utility Generators ====================

export class DataGenerator {
  /**
   * Generates random valid stream addresses
   */
  static generateStreamPair(): { from: string; to: string } {
    return {
      from: generateRandomAddress(),
      to: generateRandomAddress(),
    };
  }

  /**
   * Generates valid stream configuration
   */
  static generateStreamConfig(overrides?: {
    duration?: number;
    rate?: bigint;
  }): { ratePerSecond: bigint; duration: bigint } {
    const duration = overrides?.duration
      ? BigInt(overrides.duration)
      : BigInt(3600 + Math.floor(Math.random() * 86400)); // 1 hour to 1 day
    const rate = overrides?.rate
      ? overrides.rate
      : generateRandomBigInt(1n, 10n ** 15n);

    return { ratePerSecond: rate, duration };
  }

  /**
   * Generates proof signals for testing
   */
  static generateProofSignals(count: number = 3): string[] {
    return Array.from({ length: count }, () => generateRandomHash());
  }

  /**
   * Generates a realistic settlement scenario
   */
  static generateSettlementScenario(): {
    stream: Stream;
    elapsed: number;
    settled: bigint;
  } {
    const stream = MockDataFactory.createStream();
    const now = Math.floor(Date.now() / 1000);
    const elapsed = Math.min(
      Number(stream.end - stream.start),
      Math.floor(Math.random() * Number(stream.end - stream.start)),
    );
    const maxFlowed = stream.ratePerSecond * BigInt(elapsed);
    const settled = BigInt(Math.floor(Math.random() * Number(maxFlowed)));

    return { stream, elapsed, settled };
  }
}

// ==================== Assertion Helpers Extension ====================

export class AdvancedAssertions {
  /**
   * Asserts stream has valid economics
   */
  static assertStreamEconomics(stream: Stream): void {
    const duration = stream.end - stream.start;
    const expectedTotal = stream.ratePerSecond * duration;

    if (stream.total && stream.total !== expectedTotal) {
      throw new Error(
        `Stream total ${stream.total} does not match rate × duration ${expectedTotal}`,
      );
    }

    if (stream.settled && stream.settled > expectedTotal) {
      throw new Error(
        `Settled amount ${stream.settled} exceeds total ${expectedTotal}`,
      );
    }
  }

  /**
   * Asserts proof batch consistency
   */
  static assertBatchConsistency(batch: DualStateBatch): void {
    if (!batch.id) throw new Error("Batch must have ID");
    if (batch.states.length === 0) throw new Error("Batch must contain states");
    if (batch.states.length > PROTOCOL_CONSTANTS.MAX_BATCH_SIZE) {
      throw new Error(
        `Batch size ${batch.states.length} exceeds max ${PROTOCOL_CONSTANTS.MAX_BATCH_SIZE}`,
      );
    }

    batch.states.forEach((state, idx) => {
      if (!state.state0 || !state.state1) {
        throw new Error(`State at index ${idx} has invalid dual states`);
      }
    });
  }
}

