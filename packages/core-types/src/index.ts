export interface DualState {
  state0: string;
  state1: string;
  createdAt: bigint | number;
}

export interface Stream {
  from: string;
  to: string;
  ratePerSecond: bigint;
  start: bigint;
  end: bigint;
}

export interface DualStateProof {
  proof: string;
  publicSignals: string[];
}

export interface QStreamProof {
  proof: string;
  publicSignals: string[];
}

export interface ContractAddresses {
  token: string;
  dualStateEngine: string;
  qStreamPayments: string;
  zkVerifier?: string;
}
