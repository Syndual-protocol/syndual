# Dual-State Cryptography

Dual-state cryptography (DSC) models values that exist in two potential states (state0/state1) before a final choice is made. The Gate-01 Engine stores both states with timestamps. Finalization selects one state while retaining verifiability via ZK-DualProof.

## Rationale
- Model superposition-like behavior for commitments.
- Allow private validation of the chosen state without exposing the alternative.
- Enable composable logic across payment streams and other contracts.

## Flow
1. Author sets a dual state (state0/state1) for a key.
2. Off-chain zk circuit can prove knowledge/consistency of states.
3. Finalize selects one index; the other remains undisclosed.
