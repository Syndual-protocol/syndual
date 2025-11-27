# ZK-DualProof (ZKDP)

ZK-DualProof enables verification of a selected dual state without revealing the alternate state. Circom circuits are placeholders today but illustrate how public signals and private witnesses interact.

## Circuit Outline
- `dual_state.circom`: takes two state hashes and a selector bit; outputs the selected hash.
- `qstream_settle.circom`: multiplies `ratePerSecond` by `elapsedTime` to compute owed amounts.

## Integration
- Proof generation and verification would use snarkjs/groth16 or Plonk in production.
- Contracts currently expose a stub verifier; replace with a generated verifier once circuits are finalized.

## TODO
- Define trusted setup/PCS strategy.
- Integrate real proof generation and on-chain verifier contracts.
