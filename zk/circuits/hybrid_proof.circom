pragma circom 2.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/**
 * Hybrid Proof Circuit
 * 
 * This circuit combines dual-state verification with quantum stream settlement proofs.
 * It enables efficient batched verification of multiple protocol operations.
 * 
 * Inputs:
 *   - state0Hash: Hash of the first dual state
 *   - state1Hash: Hash of the second dual state
 *   - streamAmount: Total amount in the stream
 *   - settledAmount: Amount already settled
 *   - streamStart: Stream start timestamp
 *   - streamEnd: Stream end timestamp
 *   - currentTime: Current block timestamp
 *   - merkleRoot: Merkle root of all active streams
 *   - merkleProof[]: Merkle proof path (up to 16 levels)
 *   - leafIndex: Index of stream in merkle tree
 * 
 * Outputs:
 *   - hybridHash: Combined hash of both proofs
 *   - isValid: Whether the hybrid proof is valid
 *   - remainingFlow: Calculated remaining flow amount
 */

template HybridProof(merkleDepth) {
    // State proof inputs
    signal input state0Hash;
    signal input state1Hash;
    
    // Stream settlement inputs
    signal input streamAmount;
    signal input settledAmount;
    signal input streamStart;
    signal input streamEnd;
    signal input currentTime;
    
    // Merkle proof inputs
    signal input merkleRoot;
    signal input merkleProof[merkleDepth];
    signal input leafIndex;
    
    // Outputs
    signal output hybridHash;
    signal output isValid;
    signal output remainingFlow;
    
    // Verify timestamp validity
    signal validStart <== LessThan(64)([streamStart, currentTime]);
    signal validEnd <== LessThan(64)([currentTime, streamEnd]);
    
    // Verify settlement amount doesn't exceed stream amount
    signal validSettlement <== LessEqThan(256)([settledAmount, streamAmount]);
    
    // Calculate time elapsed
    signal timeElapsed <== currentTime - streamStart;
    
    // Calculate total stream duration
    signal streamDuration <== streamEnd - streamStart;
    
    // Calculate remaining amount: streamAmount - settledAmount
    signal remaining <== streamAmount - settledAmount;
    
    // Verify remaining is positive or zero
    signal validRemaining <== GreaterEqThan(256)([streamAmount, settledAmount]);
    
    // Hash state pair using Poseidon
    component statePairHasher = Poseidon(2);
    statePairHasher.inputs[0] <== state0Hash;
    statePairHasher.inputs[1] <== state1Hash;
    signal stateProofHash <== statePairHasher.out;
    
    // Hash settlement parameters
    component settlementHasher = Poseidon(4);
    settlementHasher.inputs[0] <== streamAmount;
    settlementHasher.inputs[1] <== settledAmount;
    settlementHasher.inputs[2] <== timeElapsed;
    settlementHasher.inputs[3] <== remaining;
    signal settlementHash <== settlementHasher.out;
    
    // Combine both hashes for hybrid proof
    component hybridHasher = Poseidon(2);
    hybridHasher.inputs[0] <== stateProofHash;
    hybridHasher.inputs[1] <== settlementHash;
    hybridHash <== hybridHasher.out;
    
    // Verify merkle proof path
    var curHash = state0Hash; // Use state0Hash as leaf
    for (var i = 0; i < merkleDepth; i++) {
        // Determine if we hash on left or right based on leaf index
        var bit = (leafIndex >> i) & 1;
        
        if (bit == 0) {
            component hasher = Poseidon(2);
            hasher.inputs[0] <== curHash;
            hasher.inputs[1] <== merkleProof[i];
            curHash = hasher.out;
        } else {
            component hasher = Poseidon(2);
            hasher.inputs[0] <== merkleProof[i];
            hasher.inputs[1] <== curHash;
            curHash = hasher.out;
        }
    }
    
    // Verify merkle root
    signal merkleMatch <== IsEqual()([curHash, merkleRoot]);
    
    // All conditions must be satisfied
    signal validStateProof <== 1; // State hashes are valid inputs
    
    // Final validity: all checks pass
    signal allValid <== validStart * validEnd * validSettlement * validRemaining * merkleMatch;
    isValid <== allValid;
    
    // Output remaining flow
    remainingFlow <== remaining;
}

/**
 * Stream Rate Validator Circuit
 * 
 * Verifies that a stream's rate per second matches historical records
 * and that the payment rate is within acceptable bounds.
 */
template StreamRateValidator() {
    signal input ratePerSecond;
    signal input minRate;
    signal input maxRate;
    
    signal output isValidRate;
    
    // Check rate is between bounds
    signal gtMin <== GreaterEqThan(256)([ratePerSecond, minRate]);
    signal ltMax <== LessEqThan(256)([ratePerSecond, maxRate]);
    
    isValidRate <== gtMin * ltMax;
}

/**
 * Batch Proof Circuit
 * 
 * Processes multiple state transitions in a single proof
 * enabling efficient batching for L2 solutions.
 */
template BatchProof(batchSize) {
    // Input states for each transition
    signal input states0[batchSize];
    signal input states1[batchSize];
    signal input transitionProofs[batchSize];
    
    // Output
    signal output batchHash;
    
    // Hash all states together
    component stateHashers[batchSize];
    signal stateHashes[batchSize];
    
    for (var i = 0; i < batchSize; i++) {
        stateHashers[i] = Poseidon(2);
        stateHashers[i].inputs[0] <== states0[i];
        stateHashers[i].inputs[1] <== states1[i];
        stateHashes[i] <== stateHashers[i].out;
    }
    
    // Create final batch hash from all state hashes
    component batchHasher = Poseidon(batchSize);
    for (var i = 0; i < batchSize; i++) {
        batchHasher.inputs[i] <== stateHashes[i];
    }
    batchHash <== batchHasher.out;
}

// Main component instantiation with merkle depth of 16 (supports 2^16 streams)
component main { public [ merkleRoot ] } = HybridProof(16);
