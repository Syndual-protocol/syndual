/**
 * Integration Facade and Quick Start Helpers
 * 
 * Simplified entry points for common operations
 */

import {
  ProtocolInitializer,
  EnvironmentConfig,
  createDevConfig,
  createProdConfig,
} from "./config";
import {
  ProtocolCacheManager,
  ProofCache,
  StreamCache,
} from "./cache";
import {
  ProtocolLogger,
  initializeGlobalLogger,
  LogLevel,
} from "./logging";
import {
  ProtocolMetrics,
  initializeMetrics,
} from "./metrics";
import {
  AccountManager,
  StreamManager,
  BatchStreamManager,
} from "./index";

/**
 * Complete protocol instance with all subsystems
 */
export class SyndualProtocol {
  private config: EnvironmentConfig;
  private initialized: boolean = false;
  private logger: ProtocolLogger;
  private metrics: ProtocolMetrics;
  private cache: ProtocolCacheManager;
  private accountManager: AccountManager;
  private streamManager: StreamManager;
  private batchStreamManager: BatchStreamManager;

  constructor(config: EnvironmentConfig) {
    this.config = config;
    this.logger = new ProtocolLogger("SyndualProtocol");
    this.metrics = initializeMetrics();
    this.cache = new ProtocolCacheManager();
    this.accountManager = new AccountManager();
    this.streamManager = new StreamManager();
    this.batchStreamManager = new BatchStreamManager();
  }

  /**
   * Initializes the protocol
   */
  async initialize(): Promise<boolean> {
    this.logger.info("Initializing Syndual Protocol");

    const initializer = new ProtocolInitializer(this.config);
    const result = await initializer.initialize();

    if (!result.success) {
      this.logger.error("Protocol initialization failed", undefined, {
        errors: result.errors,
      });
      return false;
    }

    this.initialized = true;
    this.logger.info("Syndual Protocol initialized successfully");
    return true;
  }

  /**
   * Gets the logger instance
   */
  getLogger(): ProtocolLogger {
    return this.logger;
  }

  /**
   * Gets the metrics instance
   */
  getMetrics(): ProtocolMetrics {
    return this.metrics;
  }

  /**
   * Gets the cache manager
   */
  getCache(): ProtocolCacheManager {
    return this.cache;
  }

  /**
   * Gets the account manager
   */
  getAccountManager(): AccountManager {
    return this.accountManager;
  }

  /**
   * Gets the stream manager
   */
  getStreamManager(): StreamManager {
    return this.streamManager;
  }

  /**
   * Gets the batch stream manager
   */
  getBatchStreamManager(): BatchStreamManager {
    return this.batchStreamManager;
  }

  /**
   * Gets the configuration
   */
  getConfig(): EnvironmentConfig {
    return this.config;
  }

  /**
   * Checks if protocol is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Exports all metrics
   */
  exportMetrics(): Record<string, any> {
    return this.metrics.exportJSON();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): Record<string, any> {
    return this.cache.getStats();
  }

  /**
   * Shuts down the protocol gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down Syndual Protocol");
    this.cache.destroy();
    this.initialized = false;
  }
}

/**
 * Factory for creating protocol instances
 */
export class SyndualFactory {
  /**
   * Creates a development protocol instance
   */
  static createDev(): SyndualProtocol {
    const config = createDevConfig();
    const protocol = new SyndualProtocol(config);
    initializeGlobalLogger(LogLevel.DEBUG);
    return protocol;
  }

  /**
   * Creates a production protocol instance
   */
  static createProd(overrides?: Partial<EnvironmentConfig>): SyndualProtocol {
    const config = createProdConfig(overrides || {});
    const protocol = new SyndualProtocol(config);
    initializeGlobalLogger(LogLevel.WARN);
    return protocol;
  }

  /**
   * Creates a protocol instance from environment
   */
  static createFromEnv(): SyndualProtocol {
    const configModule = require("./config");
    const config = configModule.loadConfigFromEnv();

    // Validate config
    const validation = configModule.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    const logLevel = (config.logLevel || "info") as any;
    const level =
      logLevel === "debug" ? LogLevel.DEBUG :
      logLevel === "warn" ? LogLevel.WARN :
      logLevel === "error" ? LogLevel.ERROR :
      LogLevel.INFO;

    initializeGlobalLogger(level);

    return new SyndualProtocol(config as any);
  }
}

/**
 * Quick start helper for basic operations
 */
export const QuickStart = {
  /**
   * Initializes a dev protocol and returns ready-to-use instance
   */
  async initDev(): Promise<SyndualProtocol> {
    const protocol = SyndualFactory.createDev();
    const initialized = await protocol.initialize();
    if (!initialized) {
      throw new Error("Failed to initialize protocol");
    }
    return protocol;
  },

  /**
   * Initializes a prod protocol and returns ready-to-use instance
   */
  async initProd(overrides?: Partial<EnvironmentConfig>): Promise<SyndualProtocol> {
    const protocol = SyndualFactory.createProd(overrides);
    const initialized = await protocol.initialize();
    if (!initialized) {
      throw new Error("Failed to initialize protocol");
    }
    return protocol;
  },

  /**
   * Gets version info
   */
  getVersionInfo(): { sdk: string; zk: string } {
    return {
      sdk: "1.0.0",
      zk: "1.0.0",
    };
  },
};

/**
 * Global protocol instance (singleton)
 */
let globalProtocol: SyndualProtocol | null = null;

export function getGlobalProtocol(): SyndualProtocol | null {
  return globalProtocol;
}

export function setGlobalProtocol(protocol: SyndualProtocol): void {
  globalProtocol = protocol;
}
