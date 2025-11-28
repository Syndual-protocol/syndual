export { generateDualStateProof, verifyDualStateProof } from "./dualStateProver";
export { generateQStreamProof, verifyQStreamProof } from "./qStreamProver";
export { HybridProver, createHybridProver } from "./hybridProver";
export * from "./testUtils";

// Version info
export const ZK_MODULE_VERSION = "1.0.0";
export const ZK_MODULE_NAME = "syndual-zk";
