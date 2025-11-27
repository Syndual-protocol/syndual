// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ZKDualProofVerifier {
    // TODO: integrate auto-generated verifier from snarkjs
    function verifyDualProof(bytes calldata proof, bytes32 /* publicSignal */) external pure returns (bool) {
        return proof.length > 0;
    }
}
