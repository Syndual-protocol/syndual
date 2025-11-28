/**
 * Environment Configuration and Setup Utilities
 * 
 * Manages protocol configuration, environment validation, and initialization
 */

export interface EnvironmentConfig {
  network: "mainnet" | "testnet" | "localhost";
  nodeUrl: string;
  privateKey?: string;
  contractAddresses: {
    token: string;
    dualStateEngine: string;
    qStreamPayments: string;
    zkVerifier?: string;
  };
  zkConfig: {
    circuitWasm: string;
    zkeyPath: string;
    debug?: boolean;
  };
  apiPort: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * Validates environment configuration completeness
 */
export function validateConfig(config: Partial<EnvironmentConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.network) {
    errors.push("Network must be specified (mainnet, testnet, or localhost)");
  }

  if (!config.nodeUrl) {
    errors.push("Node URL is required");
  } else if (!isValidUrl(config.nodeUrl)) {
    errors.push("Node URL is not valid");
  }

  if (!config.contractAddresses) {
    errors.push("Contract addresses must be provided");
  } else {
    const { token, dualStateEngine, qStreamPayments } = config.contractAddresses;
    if (!token || !isValidAddress(token)) {
      errors.push("Invalid or missing token address");
    }
    if (!dualStateEngine || !isValidAddress(dualStateEngine)) {
      errors.push("Invalid or missing dualStateEngine address");
    }
    if (!qStreamPayments || !isValidAddress(qStreamPayments)) {
      errors.push("Invalid or missing qStreamPayments address");
    }
  }

  if (!config.zkConfig) {
    errors.push("ZK config is required");
  } else {
    if (!config.zkConfig.circuitWasm) {
      errors.push("Circuit WASM path is required");
    }
    if (!config.zkConfig.zkeyPath) {
      errors.push("ZKEY path is required");
    }
  }

  if (!config.apiPort) {
    errors.push("API port must be specified");
  } else if (config.apiPort < 1 || config.apiPort > 65535) {
    errors.push("API port must be between 1 and 65535");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Loads configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<EnvironmentConfig> {
  return {
    network: (process.env.NETWORK || "localhost") as any,
    nodeUrl: process.env.NODE_URL || "http://localhost:8545",
    privateKey: process.env.PRIVATE_KEY,
    contractAddresses: {
      token: process.env.TOKEN_ADDRESS || "0x" + "0".repeat(40),
      dualStateEngine: process.env.DUAL_STATE_ENGINE_ADDRESS || "0x" + "0".repeat(40),
      qStreamPayments: process.env.QSTREAM_PAYMENTS_ADDRESS || "0x" + "0".repeat(40),
      zkVerifier: process.env.ZK_VERIFIER_ADDRESS,
    },
    zkConfig: {
      circuitWasm: process.env.CIRCUIT_WASM || "./circuits/hybrid_proof.wasm",
      zkeyPath: process.env.ZKEY_PATH || "./circuits/hybrid_proof.zkey",
      debug: process.env.DEBUG_ZK === "true",
    },
    apiPort: parseInt(process.env.API_PORT || "3001"),
    logLevel: (process.env.LOG_LEVEL || "info") as any,
  };
}

/**
 * Creates default configuration for development
 */
export function createDevConfig(): EnvironmentConfig {
  return {
    network: "localhost",
    nodeUrl: "http://127.0.0.1:8545",
    contractAddresses: {
      token: "0x" + "1".repeat(40),
      dualStateEngine: "0x" + "2".repeat(40),
      qStreamPayments: "0x" + "3".repeat(40),
      zkVerifier: "0x" + "4".repeat(40),
    },
    zkConfig: {
      circuitWasm: "./circuits/hybrid_proof.wasm",
      zkeyPath: "./circuits/hybrid_proof.zkey",
      debug: true,
    },
    apiPort: 3001,
    logLevel: "debug",
  };
}

/**
 * Creates configuration for production
 */
export function createProdConfig(
  overrides: Partial<EnvironmentConfig>,
): EnvironmentConfig {
  const config = loadConfigFromEnv();

  const merged: EnvironmentConfig = {
    network: (overrides.network || config.network || "mainnet") as any,
    nodeUrl: overrides.nodeUrl || config.nodeUrl || "https://eth-mainnet.example.com",
    contractAddresses: {
      ...config.contractAddresses,
      ...overrides.contractAddresses,
    } as any,
    zkConfig: {
      ...config.zkConfig,
      ...overrides.zkConfig,
      debug: false,
    } as any,
    apiPort: overrides.apiPort || config.apiPort || 3001,
    logLevel: "warn",
  };

  return merged;
}

// ==================== Validation Helpers ====================

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ==================== Feature Flags ====================

export interface FeatureFlags {
  enableDualState: boolean;
  enableQStream: boolean;
  enableHybridProofs: boolean;
  enableBatchProcessing: boolean;
  enableMetrics: boolean;
  enableCaching: boolean;
}

export function getFeatureFlags(config: EnvironmentConfig): FeatureFlags {
  return {
    enableDualState: true,
    enableQStream: true,
    enableHybridProofs: true,
    enableBatchProcessing: config.network !== "localhost",
    enableMetrics: config.network !== "localhost",
    enableCaching: config.logLevel !== "debug",
  };
}

// ==================== Protocol Parameters ====================

export const PROTOCOL_PARAMETERS = {
  // Timeouts (in milliseconds)
  PROOF_GENERATION_TIMEOUT: 30000,
  PROOF_VERIFICATION_TIMEOUT: 10000,
  SETTLEMENT_TIMEOUT: 60000,
  API_REQUEST_TIMEOUT: 30000,

  // Limits
  MAX_BATCH_SIZE: 100,
  MAX_CONCURRENT_OPERATIONS: 10,
  MAX_RETRY_ATTEMPTS: 3,

  // Merkle tree
  MERKLE_DEPTH: 16,
  MERKLE_MAX_LEAVES: 2 ** 16,

  // Settlement
  SETTLEMENT_INTERVAL: 3600, // 1 hour in seconds
  MIN_SETTLEMENT_AMOUNT: 1n,

  // Gas
  DEFAULT_GAS_LIMIT: 2000000n,
  GAS_PRICE_MULTIPLIER: 1.2,

  // Decimals
  TOKEN_DECIMALS: 18,
  RATE_DECIMALS: 18,
};

// ==================== Initialization ====================

export class ProtocolInitializer {
  private config: EnvironmentConfig;
  private initialized = false;

  constructor(config: EnvironmentConfig) {
    this.config = config;
  }

  /**
   * Initializes the protocol with validation
   */
  async initialize(): Promise<{ success: boolean; errors: string[] }> {
    const validation = validateConfig(this.config);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    try {
      // Validate network connectivity
      await this.validateNetworkConnectivity();

      // Validate contract addresses
      await this.validateContractAddresses();

      // Validate ZK setup
      await this.validateZKSetup();

      this.initialized = true;

      return { success: true, errors: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        errors: [message],
      };
    }
  }

  private async validateNetworkConnectivity(): Promise<void> {
    // In real implementation, would make RPC call
    console.log(`[Init] Validating network connectivity to ${this.config.nodeUrl}`);
  }

  private async validateContractAddresses(): Promise<void> {
    // In real implementation, would check if contracts are deployed
    console.log("[Init] Validating contract addresses");
  }

  private async validateZKSetup(): Promise<void> {
    // In real implementation, would check if ZK files exist and are valid
    console.log("[Init] Validating ZK setup");
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }
}
