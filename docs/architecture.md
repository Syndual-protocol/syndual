# Architecture

SynDual is structured as a monorepo to keep contracts, zk circuits, SDK, API, and UI aligned.

## Components
- Contracts (Hardhat): SyndualToken, DualStateEngine, ZKDualProofVerifier, QStreamPayments.
- ZK (Circom + mocked snarkjs wrappers): circuits for dual states and Q-Stream settlement.
- SDK: TypeScript client bridging dApps to contracts and zk helpers.
- API: Fastify proxy to host or trigger proof generation.
- Dashboard: Next.js + Tailwind dApp shell using the SDK.

## Data/Call Flows
```
[dApp UI] --(SDK)--> [API proxy]* --(zk helpers)--> [Proof artifacts]
   |                                   |
   +------------- on-chain ------------>+

*API is stateless and optional for local usage; proofs can be generated client-side.
```

```
[User] -> [DualStateEngine]
          | stores dual states (state0/state1)
          v
     [ZK-DualProof] verifies selected state without revealing the other
```

```
[User] -> [QStreamPayments] -> token streaming using SyndualToken
          | withdrawable computed from rate * elapsed
          v
     optional zk circuit validates settlement math off-chain
```

## Package Relationships
- `@syndual/core-types` shared types for SDK/API/zk.
- `@syndual/sdk` consumes `@syndual/core-types` and interacts with contracts.
- `@syndual/zk` offers proof helpers consumed by SDK and API.
- Dashboard depends on SDK; API depends on SDK + zk.
