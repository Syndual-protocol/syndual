import { ProtocolError, OperationStatus } from "@syndual/core-types";

/**
 * Error Handling and Recovery Utilities
 * 
 * Provides retry mechanisms, error recovery, and fault tolerance
 */

// ==================== Retry Mechanism ====================

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  timeout?: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  timeout: 30000,
};

/**
 * Executes a function with exponential backoff retry logic
 * 
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to function result
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = config.delayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timeout")), config.timeout),
        ),
      ]);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= config.backoffMultiplier;
      }
    }
  }

  throw lastError || new Error("Retry exhausted");
}

/**
 * Wraps a function to automatically retry on failure
 * 
 * @param fn - Function to wrap
 * @param options - Retry options
 * @returns Wrapped function
 */
export function retryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: Partial<RetryOptions>,
): T {
  return (async (...args: any[]) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}

// ==================== Error Classification ====================

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface ClassifiedError extends ProtocolError {
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
}

/**
 * Classifies errors for appropriate handling
 */
export function classifyError(error: Error | ProtocolError): ClassifiedError {
  const message = (error as any).message || String(error);
  const code = (error as any).code || "UNKNOWN_ERROR";

  let severity = ErrorSeverity.MEDIUM;
  let recoverable = true;
  let retryable = true;

  if (message.includes("timeout")) {
    severity = ErrorSeverity.MEDIUM;
    retryable = true;
  } else if (message.includes("network") || message.includes("connection")) {
    severity = ErrorSeverity.MEDIUM;
    retryable = true;
  } else if (message.includes("invalid") || message.includes("failed")) {
    severity = ErrorSeverity.HIGH;
    recoverable = false;
    retryable = false;
  } else if (message.includes("out of memory") || message.includes("fatal")) {
    severity = ErrorSeverity.CRITICAL;
    recoverable = false;
    retryable = false;
  }

  return {
    code,
    message,
    details: { originalError: (error as any).name },
    timestamp: Date.now(),
    severity,
    recoverable,
    retryable,
  };
}

// ==================== Fault Tolerance ====================

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  resetTimeoutMs: number;
}

export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeoutMs) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}

// ==================== Bulk Error Handler ====================

export class BulkOperationHandler {
  async executeMany<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    options: {
      maxConcurrent?: number;
      continueOnError?: boolean;
      timeout?: number;
    } = {},
  ): Promise<{ results: R[]; errors: Map<number, Error> }> {
    const { maxConcurrent = 5, continueOnError = true, timeout } = options;
    const results: R[] = [];
    const errors = new Map<number, Error>();
    const queue = [...items.entries()];
    const active = new Set<Promise<void>>();

    while (queue.length > 0 || active.size > 0) {
      while (active.size < maxConcurrent && queue.length > 0) {
        const [index, item] = queue.shift()!;

        const promise = (async () => {
          try {
            let result: R;
            if (timeout) {
              result = await Promise.race([
                fn(item),
                new Promise<R>((_, reject) =>
                  setTimeout(() => reject(new Error("Timeout")), timeout),
                ),
              ]);
            } else {
              result = await fn(item);
            }
            results[index] = result;
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            errors.set(index, err);

            if (!continueOnError) {
              throw error;
            }
          }
        })().finally(() => active.delete(promise));

        active.add(promise);
      }

      if (active.size > 0) {
        await Promise.race(active);
      }
    }

    return { results, errors };
  }
}

// ==================== Health Check ====================

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, { status: boolean; message?: string }>;
  timestamp: number;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map();

  registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async getStatus(): Promise<HealthStatus> {
    const checks: Record<string, { status: boolean; message?: string }> = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        const status = await check();
        checks[name] = { status };
        if (!status) allHealthy = false;
      } catch (error) {
        checks[name] = {
          status: false,
          message: error instanceof Error ? error.message : String(error),
        };
        allHealthy = false;
      }
    }

    const status = allHealthy ? "healthy" : "degraded";

    return {
      status,
      checks,
      timestamp: Date.now(),
    };
  }
}

// ==================== Fallback Strategy ====================

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.warn("Primary operation failed, using fallback:", error);
    return fallback();
  }
}

/**
 * Wraps multiple operations with cascade fallback
 */
export async function withFallbacks<T>(
  operations: (() => Promise<T>)[],
): Promise<T> {
  if (operations.length === 0) {
    throw new Error("No operations provided");
  }

  let lastError: Error | null = null;

  for (const operation of operations) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("All fallback operations failed");
}
