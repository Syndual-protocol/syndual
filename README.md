# SynDual Protocol

SynDual Protocol is a quantum-inspired cryptography stack that explores **Dual-State Cryptography (DSC)**, the **Gate-01 Engine** for dual-state execution, **ZK-DualProof (ZKDP)** for private verification, and **Q-Stream Micropayments** for continuous settlement. This monorepo bundles smart contracts, zk circuits, a TypeScript SDK, an API proxy, a Next.js dashboard, and documentation.

## Packages
- `contracts`: Solidity contracts (SyndualToken, DualStateEngine, ZKDualProofVerifier, QStreamPayments) with Hardhat.
- `zk`: Circom circuits and mocked snarkjs-style wrappers for ZK-DualProof.
- `packages/sdk`: TypeScript SDK for interacting with contracts and zk utilities.
- `packages/core-types`: Shared TypeScript types.
- `apps/api`: Fastify API proxy for proof requests.
- `apps/dashboard`: Next.js + Tailwind dashboard.
- `docs`: Concept docs and architecture notes.

## Getting Started
1. Install pnpm if needed: `npm i -g pnpm`.
2. Install deps: `pnpm install`.
3. Build all: `pnpm build`.
4. Run tests: `pnpm test` (Hardhat tests in `contracts`).

## Concepts
- **Dual-State Cryptography (DSC)**: Values exist in dual states (state0/state1) until finalized, mirroring superposition-like behavior.
- **Gate-01 Engine**: Contract logic for managing and finalizing dual states.
- **ZK-DualProof (ZKDP)**: Zero-knowledge verification of dual-state transitions without revealing the raw states.
- **Q-Stream Micropayments**: Continuous token streaming and settlement using SyndualToken.

## Repo Layout
Contracts and zk circuits live alongside the SDK, API, and dashboard so changes can be coordinated. Turborepo and pnpm workspaces coordinate builds, linting, and tests.
