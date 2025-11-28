import {
  DualStateProof,
  QStreamProof,
  HybridProof,
  Stream,
  DualState,
  ValidationResult,
} from "@syndual/core-types";
import { ethers } from "ethers";

/**
 * Advanced Hybrid Prover
 * 
 * Combines dual-state and quantum stream proofs for efficient batched verification
 * and supports complex protocol operations involving both state transitions and payments.
 */

interface ProverConfig {
  circuitWasm: string;
  zkeyPath: string;
  timeout?: number;
  debug?: boolean;
}

interface HybridProverState {
  dualStates: DualState[];
  streams: Stream[];
  proofs: HybridProof[];
  merkleRoot: string;
  batchTimestamp: number;
}

export class HybridProver {
  private config: ProverConfig;
  private proverState: HybridProverState;

  constructor(config: ProverConfig) {
    this.config = config;
    this.proverState = {
      dualStates: [],
      streams: [],
      proofs: [],
      merkleRoot: "",
      batchTimestamp: Date.now(),
    };
  }

  /**
   * Generates a hybrid proof combining dual-state and stream verification
   */
  async generateHybridProof(
    dualState: DualState,
    stream: Stream,
    dualStateProof: DualStateProof,
    streamProof: QStreamProof,
  ): Promise<HybridProof> {
    try {
      if (this.config.debug) {
        console.log("[HybridProver] Generating hybrid proof", {
          dualStateId: dualState.hash,
          streamFrom: stream.from,
          streamTo: stream.to,
        });
      }

      // Combine public signals from both proofs
      const combinedSignals = [
        ...dualStateProof.publicSignals,
        ...streamProof.publicSignals,
        // Add stream metadata
        stream.ratePerSecond.toString(),
        stream.start.toString(),
        stream.end.toString(),
      ];

      // Create hybrid proof ID from combined data
      const hybridId = ethers.id(
        JSON.stringify({
          dualStateHash: dualState.hash,
          streamFrom: stream.from,
          streamTo: stream.to,
          timestamp: Date.now(),
        }),
      );

      const hybridProof: HybridProof = {
        id: hybridId,
        dualStateProof,
        streamProof,
        combinedSignals,
        timestamp: Date.now(),
        verified: this.verifyProofSignatures(dualStateProof, streamProof),
      };

      // Store in state for batch operations
      this.proverState.proofs.push(hybridProof);

      return hybridProof;
    } catch (error) {
      throw new Error(`Failed to generate hybrid proof: ${error}`);
    }
  }

  /**
   * Generates a batch of hybrid proofs for multiple stream-state pairs
   */
  async generateBatchProofs(
    dualStates: DualState[],
    streams: Stream[],
    dualStateProofs: DualStateProof[],
    streamProofs: QStreamProof[],
  ): Promise<HybridProof[]> {
    if (
      dualStates.length !== streams.length ||
      dualStateProofs.length !== streamProofs.length ||
      dualStates.length !== dualStateProofs.length
    ) {
      throw new Error("Input arrays must have equal length");
    }

    const proofs: HybridProof[] = [];

    for (let i = 0; i < dualStates.length; i++) {
      const proof = await this.generateHybridProof(
        dualStates[i],
        streams[i],
        dualStateProofs[i],
        streamProofs[i],
      );
      proofs.push(proof);
    }

    return proofs;
  }

  /**
   * Computes a merkle root for all proofs in the current batch
   */
  computeMerkleRoot(): string {
    if (this.proverState.proofs.length === 0) {
      return ethers.keccak256("0x");
    }

    let currentHashes = this.proverState.proofs.map((proof) =>
      ethers.keccak256(ethers.toBeHex(proof.id)),
    );

    while (currentHashes.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentHashes.length; i += 2) {
        const left = currentHashes[i];
        const right = currentHashes[i + 1] || left;
        const combined = ethers.keccak256(
          ethers.concat([left, right]),
        );
        nextLevel.push(combined);
      }
      currentHashes = nextLevel;
    }

    this.proverState.merkleRoot = currentHashes[0];
    return this.proverState.merkleRoot;
  }

  /**
   * Validates the cryptographic signatures in both proofs
   */
  private verifyProofSignatures(
    dualStateProof: DualStateProof,
    streamProof: QStreamProof,
  ): boolean {
    try {
      // In production, this would verify actual ZK proof signatures
      // For now, perform basic structural validation
      if (!dualStateProof.proof || dualStateProof.proof.length === 0) {
        return false;
      }

      if (!streamProof.proof || streamProof.proof.length === 0) {
        return false;
      }

      if (!dualStateProof.publicSignals || dualStateProof.publicSignals.length === 0) {
        return false;
      }

      if (!streamProof.publicSignals || streamProof.publicSignals.length === 0) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates a hybrid proof against multiple criteria
   */
  async validateHybridProof(proof: HybridProof): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate structure
    if (!proof.id) {
      errors.push("Proof ID is missing");
    }

    if (!proof.dualStateProof) {
      errors.push("Dual state proof is missing");
    }

    if (!proof.streamProof) {
      errors.push("Stream proof is missing");
    }

    if (!proof.combinedSignals || proof.combinedSignals.length < 4) {
      errors.push("Combined signals are incomplete or missing");
    }

    // Validate timestamps
    if (proof.timestamp > Date.now()) {
      warnings.push("Proof timestamp is in the future");
    }

    if (proof.timestamp < Date.now() - 3600000) {
      warnings.push("Proof is older than 1 hour");
    }

    // Validate proofs
    if (!this.verifyProofSignatures(proof.dualStateProof, proof.streamProof)) {
      errors.push("Proof signatures are invalid");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        proofId: proof.id,
        verified: proof.verified,
        signalCount: proof.combinedSignals.length,
      },
    };
  }

  /**
   * Gets the current batch state
   */
  getBatchState(): HybridProverState {
    return {
      ...this.proverState,
      merkleRoot: this.computeMerkleRoot(),
    };
  }

  /**
   * Resets the batch state for a new batch
   */
  resetBatch(): void {
    this.proverState = {
      dualStates: [],
      streams: [],
      proofs: [],
      merkleRoot: "",
      batchTimestamp: Date.now(),
    };
  }

  /**
   * Exports the current batch as serializable data
   */
  exportBatch(): string {
    const state = this.getBatchState();
    return JSON.stringify(
      {
        ...state,
        proofs: state.proofs.map((p) => ({
          id: p.id,
          timestamp: p.timestamp,
          verified: p.verified,
          signalCount: p.combinedSignals.length,
        })),
      },
      null,
      2,
    );
  }

  /**
   * Generates proof for settlement verification
   */
  async generateSettlementProof(
    stream: Stream,
    settledAmount: bigint,
    currentTime: number,
  ): Promise<QStreamProof & { settlementAmount: bigint }> {
    const timeElapsed = BigInt(currentTime) - stream.start;
    const expectedFlow = stream.ratePerSecond * timeElapsed;

    if (settledAmount > expectedFlow) {
      throw new Error("Settled amount exceeds expected flow");
    }

    return {
      proof: ethers.id(
        JSON.stringify({
          stream,
          settledAmount,
          timestamp: currentTime,
        }),
      ),
      publicSignals: [
        expectedFlow.toString(),
        settledAmount.toString(),
        timeElapsed.toString(),
      ],
      timestamp: currentTime,
      verified: settledAmount <= expectedFlow,
      settlementAmount: settledAmount,
    };
  }

  /**
   * Computes the size and complexity of proof operations
   */
  getProofComplexity(): {
    proofCount: number;
    totalSignals: number;
    estimatedGas: number;
    merkleDepth: number;
  } {
    const proofCount = this.proverState.proofs.length;
    const totalSignals = this.proverState.proofs.reduce(
      (sum, p) => sum + p.combinedSignals.length,
      0,
    );
    const merkleDepth = Math.ceil(Math.log2(Math.max(proofCount, 1)));

    // Rough gas estimates for verification
    const baseGas = 25000;
    const perProofGas = 100000;
    const perSignalGas = 500;
    const estimatedGas = baseGas + proofCount * perProofGas + totalSignals * perSignalGas;

    return {
      proofCount,
      totalSignals,
      estimatedGas,
      merkleDepth,
    };
  }
}

/**
 * Utility function to create and configure a hybrid prover
 */
export function createHybridProver(config: Partial<ProverConfig> = {}): HybridProver {
  const defaultConfig: ProverConfig = {
    circuitWasm: process.env.CIRCUIT_WASM || "./circuits/hybrid_proof.wasm",
    zkeyPath: process.env.ZKEY_PATH || "./circuits/hybrid_proof.zkey",
    timeout: 30000,
    debug: process.env.DEBUG_PROVER === "true",
  };

  return new HybridProver({ ...defaultConfig, ...config });
}
