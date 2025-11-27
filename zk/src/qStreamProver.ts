import { QStreamProof } from "@syndual/core-types";

export const generateQStreamProof = async (
  ratePerSecond: bigint,
  elapsedTime: bigint,
): Promise<QStreamProof> => {
  console.log("TODO: integrate real snarkjs proof generation for Q-Stream");
  const owed = ratePerSecond * elapsedTime;
  return {
    proof: `0xqstream-${ratePerSecond}-${elapsedTime}`,
    publicSignals: [ratePerSecond.toString(), elapsedTime.toString(), owed.toString()],
  };
};

export const verifyQStreamProof = async (proof: QStreamProof): Promise<boolean> => {
  console.log("TODO: integrate real proof verification");
  return Boolean(proof.proof);
};
