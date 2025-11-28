/**
 * Metrics and Monitoring System
 * 
 * Tracks performance metrics, system health, and protocol statistics
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

/**
 * Gauge metric - can go up or down
 */
export class Gauge {
  private value: number = 0;
  readonly name: string;

  constructor(name: string, initialValue: number = 0) {
    this.name = name;
    this.value = initialValue;
  }

  set(value: number): void {
    this.value = value;
  }

  inc(amount: number = 1): void {
    this.value += amount;
  }

  dec(amount: number = 1): void {
    this.value -= amount;
  }

  getValue(): number {
    return this.value;
  }
}

/**
 * Counter metric - only increases
 */
export class Counter {
  private value: number = 0;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  inc(amount: number = 1): void {
    this.value += Math.max(amount, 0);
  }

  getValue(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
  }
}

/**
 * Histogram metric - tracks distribution of values
 */
export class Histogram {
  private buckets: Map<number, number>;
  readonly name: string;
  readonly boundaries: number[];

  constructor(name: string, boundaries: number[] = [0.1, 0.5, 1, 5, 10]) {
    this.name = name;
    this.boundaries = boundaries.sort((a, b) => a - b);
    this.buckets = new Map(this.boundaries.map((b) => [b, 0]));
  }

  observe(value: number): void {
    for (const boundary of this.boundaries) {
      if (value <= boundary) {
        this.buckets.set(boundary, (this.buckets.get(boundary) ?? 0) + 1);
      }
    }
  }

  getBuckets(): HistogramBucket[] {
    return this.boundaries.map((le) => ({
      le,
      count: this.buckets.get(le) ?? 0,
    }));
  }

  reset(): void {
    for (const boundary of this.boundaries) {
      this.buckets.set(boundary, 0);
    }
  }
}

/**
 * Central metrics registry
 */
export class MetricsRegistry {
  private gauges = new Map<string, Gauge>();
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();

  /**
   * Registers or gets a gauge
   */
  gauge(name: string, initialValue?: number): Gauge {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Gauge(name, initialValue));
    }
    return this.gauges.get(name)!;
  }

  /**
   * Registers or gets a counter
   */
  counter(name: string): Counter {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Counter(name));
    }
    return this.counters.get(name)!;
  }

  /**
   * Registers or gets a histogram
   */
  histogram(name: string, boundaries?: number[]): Histogram {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Histogram(name, boundaries));
    }
    return this.histograms.get(name)!;
  }

  /**
   * Gets all metrics in Prometheus format
   */
  exportPrometheus(): string {
    let output = "";

    for (const [name, gauge] of this.gauges) {
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${gauge.getValue()}\n`;
    }

    for (const [name, counter] of this.counters) {
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${counter.getValue()}\n`;
    }

    for (const [name, histogram] of this.histograms) {
      output += `# TYPE ${name} histogram\n`;
      for (const bucket of histogram.getBuckets()) {
        output += `${name}_bucket{le="${bucket.le}"} ${bucket.count}\n`;
      }
    }

    return output;
  }

  /**
   * Gets all metrics as JSON
   */
  exportJSON(): Record<string, any> {
    return {
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([name, gauge]) => [name, gauge.getValue()]),
      ),
      counters: Object.fromEntries(
        Array.from(this.counters.entries()).map(([name, counter]) => [name, counter.getValue()]),
      ),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, histogram]) => [name, histogram.getBuckets()]),
      ),
    };
  }

  /**
   * Resets all metrics
   */
  reset(): void {
    for (const gauge of this.gauges.values()) {
      gauge.set(0);
    }
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
  }
}

/**
 * Protocol-specific metrics
 */
export class ProtocolMetrics {
  private registry: MetricsRegistry;

  // Proof metrics
  readonly proofsGenerated: Counter;
  readonly proofsVerified: Counter;
  readonly proofGenerationTime: Histogram;
  readonly proofVerificationTime: Histogram;

  // Stream metrics
  readonly streamsCreated: Counter;
  readonly streamsSettled: Counter;
  readonly streamsActive: Gauge;
  readonly streamTotalValue: Gauge;

  // Transaction metrics
  readonly transactionsSubmitted: Counter;
  readonly transactionsSucceeded: Counter;
  readonly transactionsFailed: Counter;
  readonly transactionGasUsed: Gauge;

  // Cache metrics
  readonly cacheHits: Counter;
  readonly cacheMisses: Counter;
  readonly cacheSize: Gauge;

  // Error metrics
  readonly errorsTotal: Counter;
  readonly errorsByType: Map<string, Counter>;

  constructor(registry?: MetricsRegistry) {
    this.registry = registry ?? new MetricsRegistry();
    this.errorsByType = new Map();

    // Initialize all metrics
    this.proofsGenerated = this.registry.counter("protocol_proofs_generated");
    this.proofsVerified = this.registry.counter("protocol_proofs_verified");
    this.proofGenerationTime = this.registry.histogram(
      "protocol_proof_generation_seconds",
      [0.1, 0.5, 1, 5, 10],
    );
    this.proofVerificationTime = this.registry.histogram(
      "protocol_proof_verification_seconds",
      [0.01, 0.05, 0.1, 0.5, 1],
    );

    this.streamsCreated = this.registry.counter("protocol_streams_created");
    this.streamsSettled = this.registry.counter("protocol_streams_settled");
    this.streamsActive = this.registry.gauge("protocol_streams_active");
    this.streamTotalValue = this.registry.gauge("protocol_stream_total_value");

    this.transactionsSubmitted = this.registry.counter("protocol_transactions_submitted");
    this.transactionsSucceeded = this.registry.counter("protocol_transactions_succeeded");
    this.transactionsFailed = this.registry.counter("protocol_transactions_failed");
    this.transactionGasUsed = this.registry.gauge("protocol_transaction_gas_used");

    this.cacheHits = this.registry.counter("protocol_cache_hits");
    this.cacheMisses = this.registry.counter("protocol_cache_misses");
    this.cacheSize = this.registry.gauge("protocol_cache_size");

    this.errorsTotal = this.registry.counter("protocol_errors_total");
  }

  /**
   * Records an error occurrence
   */
  recordError(type: string): void {
    this.errorsTotal.inc();

    if (!this.errorsByType.has(type)) {
      this.errorsByType.set(type, this.registry.counter(`protocol_errors_${type}`));
    }

    this.errorsByType.get(type)!.inc();
  }

  /**
   * Gets the registry
   */
  getRegistry(): MetricsRegistry {
    return this.registry;
  }

  /**
   * Exports metrics in Prometheus format
   */
  exportPrometheus(): string {
    return this.registry.exportPrometheus();
  }

  /**
   * Exports metrics as JSON
   */
  exportJSON(): Record<string, any> {
    return {
      ...this.registry.exportJSON(),
      errors: Object.fromEntries(
        Array.from(this.errorsByType.entries()).map(([type, counter]) => [
          type,
          counter.getValue(),
        ]),
      ),
    };
  }
}

/**
 * Global metrics instance
 */
let globalMetrics: ProtocolMetrics | null = null;

export function initializeMetrics(registry?: MetricsRegistry): ProtocolMetrics {
  globalMetrics = new ProtocolMetrics(registry);
  return globalMetrics;
}

export function getMetrics(): ProtocolMetrics {
  if (!globalMetrics) {
    globalMetrics = initializeMetrics();
  }
  return globalMetrics;
}
