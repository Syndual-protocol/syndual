import { DualStateProof } from "@syndual/core-types";

export const generateDualStateProof = async (
  state0: string,
  state1: string,
  selector: 0 | 1,
): Promise<DualStateProof> => {
  console.log("TODO: integrate real snarkjs proof generation for dual states");
  return {
    proof: `0xdual-${selector}-${state0}-${state1}`,
    publicSignals: [selector.toString(), state0, state1],
  };
};

export const verifyDualStateProof = async (proof: DualStateProof): Promise<boolean> => {
  console.log("TODO: integrate real proof verification");
  return Boolean(proof.proof);
};
