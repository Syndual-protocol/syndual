/**
 * Represents a dual-state quantum-inspired state object
 * Maintains two concurrent states for parallel computation
 */
export interface DualState {
  state0: string;
  state1: string;
  createdAt: bigint | number;
  hash?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Represents a continuous payment stream
 * Defines a unidirectional flow of value over time
 */
export interface Stream {
  from: string;
  to: string;
  ratePerSecond: bigint;
  start: bigint;
  end: bigint;
  total?: bigint;
  settled?: bigint;
  paused?: boolean;
}

/**
 * Zero-knowledge proof for dual-state verification
 */
export interface DualStateProof {
  proof: string;
  publicSignals: string[];
  timestamp?: number;
  verified?: boolean;
}

/**
 * Zero-knowledge proof for quantum stream settlement
 */
export interface QStreamProof {
  proof: string;
  publicSignals: string[];
  timestamp?: number;
  verified?: boolean;
}

/**
 * Contract addresses for the Syndual protocol deployment
 */
export interface ContractAddresses {
  token: string;
  dualStateEngine: string;
  qStreamPayments: string;
  zkVerifier?: string;
}

/**
 * Transaction result from contract interaction
 */
export interface TransactionResult {
  hash: string;
  blockNumber?: number;
  gasUsed?: bigint;
  status?: 'success' | 'failed' | 'pending' | 'reverted';
}

/**
 * Error response for protocol operations
 */
export interface ProtocolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Proof types supported by the Syndual protocol
 */
export enum ProofType {
  DUAL_STATE = 'DUAL_STATE',
  QSTREAM = 'QSTREAM',
  HYBRID = 'HYBRID',
  SETTLEMENT = 'SETTLEMENT',
  MERKLE_BATCH = 'MERKLE_BATCH',
}

/**
 * Stream status enumeration
 */
export enum StreamStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

/**
 * Protocol operation status
 */
export enum OperationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERTED = 'REVERTED',
}

/**
 * Batch of dual-state transitions for efficient processing
 */
export interface DualStateBatch {
  id: string;
  states: DualState[];
  timestamp: number;
  proof?: DualStateProof;
  proofType?: ProofType;
}

/**
 * Stream settlement data with proof verification
 */
export interface StreamSettlement {
  streamId: string;
  settlementAmount: bigint;
  settledAt: number;
  proof: QStreamProof;
  status: OperationStatus;
}

/**
 * Hybrid proof combining dual-state and stream data
 */
export interface HybridProof {
  id: string;
  dualStateProof: DualStateProof;
  streamProof: QStreamProof;
  combinedSignals: string[];
  timestamp: number;
  verified: boolean;
}

/**
 * Configuration for proof generation
 */
export interface ProofConfig {
  circuitWasm: string;
  zkeyPath: string;
  timeout?: number;
  debug?: boolean;
}

/**
 * Query result for stream data
 */
export interface StreamQuery {
  streamId: string;
  status: StreamStatus;
  totalFlowed: bigint;
  remainingAmount: bigint;
  nextSettlementTime: number;
}

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * User account information in the protocol
 */
export interface Account {
  address: string;
  nonce: number;
  balance: bigint;
  streamsActive: number;
  totalStreamed: bigint;
  reputation?: number;
}

/**
 * Type for utility helper functions
 */
export type ProofValidator = (proof: DualStateProof | QStreamProof) => Promise<boolean>;
export type StateHasher = (state: DualState) => string;
export type StreamCalculator = (stream: Stream, currentTime: number) => bigint;

