# SynDual Protocol

> **Quantum-inspired cryptography for dual-state, verifiable on-chain computation.**

SynDual is a quantum-inspired cryptography protocol built around **Dual-State Cryptography (DSC)** — a novel primitive that lets on-chain systems represent information in a *superposed* `0/1` state before collapsing into verifiable truth.

The protocol introduces quantum-theoretic concepts to decentralized systems through:

- **Dual-State Execution**
- **Gate-01 Engine**
- **Quantum-ZK (QZK) proof layer**
- **Q-Stream micropayments**
- **Quantum-safe hashing & signatures**

SynDual is designed to support:

- Next-generation blockchain infrastructure  
- Multi-chain coordination networks  
- AI inference verification  
- Post-quantum cryptography research  

---

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
  - [Dual-State Cryptography (DSC)](#dual-state-cryptography-dsc)
  - [Gate-01 Engine](#gate-01-engine)
  - [Quantum-ZK Layer (QZK)](#quantum-zk-layer-qzk)
  - [Q-Stream Micropayments](#q-stream-micropayments)
  - [Quantum-Safe Hashing & Signatures](#quantum-safe-hashing--signatures)
- [Monorepo Structure](#monorepo-structure)
- [Getting Started](#getting-started)
- [Components](#components)
  - [1. Smart Contracts](#1-smart-contracts)
  - [2. zk Module](#2-zk-module)
  - [3. TypeScript SDK](#3-typescript-sdk)
  - [4. Dashboard](#4-dashboard)
- [Documentation](#documentation)
- [Security](#security)
- [Research Direction](#research-direction)
- [Contributing](#contributing)
- [Contact](#contact)

---

## Overview

SynDual brings **dual-state computation** to blockchains: values can exist in a *dual* (`state₀` / `state₁`) representation until they are finalized and proven. This enables:

- Pre-finalization privacy
- Parallel state evaluation
- Faster settlement with verifiable outcomes
- Richer expressiveness for high-dimensional, quantum-inspired logic

---

## Core Concepts

### Dual-State Cryptography (DSC)

A cryptographic model inspired by quantum superposition.

- Values are represented as **`state₀` / `state₁` simultaneously** until a finalization event.
- Finalization produces a **verifiable, deterministic truth** that can be checked on-chain.

**Benefits**

- ⚡ Faster settlement through deferred finalization  
- 🧵 Parallel evaluation of multiple potential states  
- 🧮 Reduced on-chain computation load (evaluate only when needed)  
- 🕶 Enhanced privacy for pre-finalization states  

---

### Gate-01 Engine

The **Gate-01 Engine** is the protocol’s execution layer, modeled after the first quantum gate where `0` and `1` coexist.

Gate-01 enables:

- **Dual-state transitions** — controlled evolution of superposed states  
- **Entanglement-style state binding** — link multiple states so they finalize consistently  
- **Probabilistic state selection** — encode probabilistic rules into finalization  
- **Hybrid deterministic + quantum-inspired execution** — deterministic settlement over dual-state evolution  

---

### Quantum-ZK Layer (QZK)

A next-generation zero-knowledge system aligned with **quantum resilience** and dual-state semantics.

Key features:

- **ZK-DualProof (ZKDP)**: proofs tailored for DSC & Gate-01 transitions  
- **ZK proof compression**: reduce proof size & verification cost  
- **Quantum-safe hashing**: swap in PQ-friendly hash functions  
- **High-dimensional circuit execution**: model complex dual-state processes  

---

### Q-Stream Micropayments

**Q-Stream** is a continuous settlement layer for **machine-to-machine** and **protocol-level** micropayments.

It supports:

- **Sub-second micro-settlement** (stream-like flows)  
- **Dual-state priced streams** — prices can remain dual-state before finalization  
- **Quantum-entropy randomness injection** — leverage entropy for pricing, rewards, or routing  

---

### Quantum-Safe Hashing & Signatures

SynDual experiments with **post-quantum-oriented** primitives:

- Quantum-resistant hash functions for ZK and state commitments  
- Quantum-safe signature schemes (research-grade / experimental)  
- Integration paths for PQ schemes inside DSC, Gate-01, and QZK flows  

> 🧪 **Note:** All PQ and quantum-safe primitives in SynDual are experimental and intended for research only.

---

## Monorepo Structure

```text
syndual-protocol/
  contracts/            # Solidity contracts (DSC, Gate-01, QStream, ZKDP verifier)
  zk/                   # Circom circuits + proof system
  packages/
    sdk/                # TypeScript SDK for developers
    core-types/         # Shared types/interfaces
  apps/
    api/                # Minimal API for proof requests & state operations
    dashboard/          # Developer dashboard (Next.js)
  docs/                 # Technical documentation (GitBook source)
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/syndual.git
cd syndual
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build the monorepo

```bash
pnpm build
```

### 4. Run contract tests

```bash
pnpm --filter @syndual/contracts test
```

### 5. Start the dashboard

```bash
pnpm --filter @syndual/dashboard dev
```

Then open the dashboard in your browser (default: `http://localhost:3000`).

---

## Components

### 1. Smart Contracts

Implemented in Solidity (Hardhat).

Core contracts:

- `DualStateEngine.sol`  
  - Manages dual-state values and Gate-01 transitions.
- `ZKDualProofVerifier.sol`  
  - On-chain verifier for ZK-DualProof (ZKDP) proofs.
- `QStreamPayments.sol`  
  - Handles continuous Q-Stream micropayment logic.
- `SyndualToken.sol`  
  - Utility / governance token (optional, depends on configuration).

---

### 2. zk Module

Located in `/zk`.

- **Circom circuits** for:
  - `dual_state.circom` — dual-state constraints & transitions  
  - `qstream_settle.circom` — settlement logic for Q-Stream flows  
- **Mock proving system** for local development and integration testing.

Intended use:

- Generate ZKDP proofs off-chain.  
- Verify proofs on-chain via `ZKDualProofVerifier`.

---

### 3. TypeScript SDK

Located in `packages/sdk`.

The SDK wraps SynDual primitives for seamless integration in dApps, services, and infra:

- **Dual-state management**
  - Create, update, and finalize DSC values.
- **Gate-01 transitions**
  - Trigger dual-state transitions with deterministic or probabilistic rules.
- **Q-Stream management**
  - Create Q-Streams, modify parameters, and withdraw settled funds.
- **ZK proof requests**
  - Request proofs from the zk module / proving service and submit to on-chain verifiers.

Shared types & interfaces live in `packages/core-types`.

---

### 4. Dashboard

Located in `apps/dashboard` (Next.js).

Developer-oriented UI for:

- Inspecting and modifying dual-state values  
- Simulating Gate-01 transitions  
- Creating & monitoring Q-Streams  
- Sending and verifying ZKDP proof requests  

Intended for:

- Protocol researchers  
- Smart contract developers  
- zk / infra engineers  

---

## Documentation

Full technical documentation is available in the `/docs` directory (GitBook-ready).

Covered topics include:

- **Dual-State Cryptography (DSC)**  
- **Gate-01 Architecture & semantics**  
- **ZK-DualProof (ZKDP)**  
- **Q-Stream Protocol & settlement flows**  
- **Integrations & API** (REST / SDK)  

You can publish docs to GitBook or any static site host.

---

## Security

> ⚠️ **Research-grade protocol — not production ready.**

- SynDual is an **experimental, quantum-inspired cryptography protocol**.
- All cryptographic components are **under active peer review**.
- No guarantees are given regarding:
  - Economic safety  
  - Cryptographic soundness  
  - Implementation security  

**Do not deploy to mainnet or safeguard real value** until:

- Formal audits are completed  
- Protocol security assumptions are independently reviewed  

---

## Research Direction

SynDual is evolving toward:

- **Post-quantum signature schemes** integrated with DSC  
- **Quantum entropy–based randomness** for Q-Stream & routing  
- **Hybrid quantum-classical verification** pipelines  
- **Quantum-safe MPC** and shared dual-state evaluation  
- **Multi-chain entanglement routing** for cross-chain dual-state linking  

If you are working on quantum-resistant cryptography, zk, or MPC, contributions and critique are welcome.

---

## Contributing

1. Fork the repository.  
2. Create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "feat: add my-feature"
   ```
4. Push and open a pull request.

Use GitHub Issues for:

- Bug reports  
- Design discussions  
- Protocol / cryptography questions  

---

## Contact

- **X (Twitter):** [@Syndual](https://x.com/Syndual) *(placeholder)*  
- **Email:** `contact@syndual.org` *(optional placeholder)*  
- **GitHub Issues:** use the repo issue tracker for bugs and contributions.

---
