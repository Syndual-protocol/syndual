/**
 * Caching System
 * 
 * Provides in-memory caching with TTL, invalidation, and eviction strategies
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

export enum EvictionPolicy {
  LRU = "lru", // Least Recently Used
  LFU = "lfu", // Least Frequently Used
  FIFO = "fifo", // First In First Out
}

/**
 * Generic in-memory cache with TTL and eviction policies
 */
export class Cache<K, V> {
  private entries = new Map<K, CacheEntry<V>>();
  private stats: CacheStats = { size: 0, hits: 0, misses: 0, evictions: 0 };
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor(
    private maxSize: number = 10_00,
    private defaultTtlMs: number = 3600000, // 1 hour
    private evictionPolicy: EvictionPolicy = EvictionPolicy.LRU,
  ) {
    // Start periodic cleanup of expired entries
    this.startCleanup();
  }

  /**
   * Gets a value from cache
   */
  get(key: K): V | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      this.stats.misses++;
      return undefined;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Sets a value in cache with optional custom TTL
   */
  set(key: K, value: V, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);

    if (this.entries.has(key)) {
      const entry = this.entries.get(key)!;
      entry.value = value;
      entry.expiresAt = expiresAt;
      entry.hits = 0;
      return;
    }

    if (this.entries.size >= this.maxSize) {
      this.evict();
    }

    this.entries.set(key, {
      value,
      expiresAt,
      hits: 0,
      createdAt: Date.now(),
    });

    this.stats.size = this.entries.size;
  }

  /**
   * Deletes a cache entry
   */
  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.entries.clear();
    this.stats = { ...this.stats, size: 0 };
  }

  /**
   * Gets cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Invalidates entries matching a predicate
   */
  invalidate(predicate: (key: K, entry: CacheEntry<V>) => boolean): number {
    let count = 0;

    for (const [key, entry] of this.entries) {
      if (predicate(key, entry)) {
        this.entries.delete(key);
        count++;
      }
    }

    this.stats.size = this.entries.size;
    return count;
  }

  /**
   * Gets cache size
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Evicts one entry based on policy
   */
  private evict(): void {
    let keyToEvict: K | null = null;

    if (this.evictionPolicy === EvictionPolicy.LRU) {
      // Evict least recently used (oldest createdAt without recent hits)
      let minTime = Infinity;
      for (const [key, entry] of this.entries) {
        if (entry.hits === 0 && entry.createdAt < minTime) {
          minTime = entry.createdAt;
          keyToEvict = key;
        }
      }

      // If all have hits, evict oldest
      if (!keyToEvict) {
        for (const [key, entry] of this.entries) {
          if (entry.createdAt < minTime) {
            minTime = entry.createdAt;
            keyToEvict = key;
          }
        }
      }
    } else if (this.evictionPolicy === EvictionPolicy.LFU) {
      // Evict least frequently used (fewest hits)
      let minHits = Infinity;
      for (const [key, entry] of this.entries) {
        if (entry.hits < minHits) {
          minHits = entry.hits;
          keyToEvict = key;
        }
      }
    } else if (this.evictionPolicy === EvictionPolicy.FIFO) {
      // Evict first in (oldest created)
      let minTime = Infinity;
      for (const [key, entry] of this.entries) {
        if (entry.createdAt < minTime) {
          minTime = entry.createdAt;
          keyToEvict = key;
        }
      }
    }

    if (keyToEvict !== null) {
      this.entries.delete(keyToEvict);
      this.stats.evictions++;
      this.stats.size = this.entries.size;
    }
  }

  /**
   * Starts periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      let removed = 0;
      const now = Date.now();

      for (const [key, entry] of this.entries) {
        if (entry.expiresAt < now) {
          this.entries.delete(key);
          removed++;
        }
      }

      if (removed > 0) {
        this.stats.size = this.entries.size;
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Stops the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Proof cache for storing generated proofs
 */
export class ProofCache extends Cache<string, any> {
  constructor() {
    super(500, 1800000, EvictionPolicy.LRU); // 30 min TTL
  }

  cacheProof(id: string, proof: any, ttlMs?: number): void {
    this.set(id, proof, ttlMs);
  }

  getProof(id: string): any | undefined {
    return this.get(id);
  }

  invalidateProofsByAge(maxAgeMs: number): number {
    const now = Date.now();
    return this.invalidate((_, entry) => now - entry.createdAt > maxAgeMs);
  }
}

/**
 * Stream cache for storing stream information
 */
export class StreamCache extends Cache<string, any> {
  constructor() {
    super(1000, 600000, EvictionPolicy.LRU); // 10 min TTL
  }

  cacheStream(streamId: string, stream: any, ttlMs?: number): void {
    this.set(streamId, stream, ttlMs);
  }

  getStream(streamId: string): any | undefined {
    return this.get(streamId);
  }

  invalidateStreamsByStatus(statusFilter?: string): number {
    return this.invalidate((_, entry) => {
      if (!statusFilter) return true;
      return entry.value.status === statusFilter;
    });
  }
}

/**
 * Composite cache manager for the protocol
 */
export class ProtocolCacheManager {
  private proofCache: ProofCache;
  private streamCache: StreamCache;
  private resultCache: Cache<string, any>;

  constructor() {
    this.proofCache = new ProofCache();
    this.streamCache = new StreamCache();
    this.resultCache = new Cache(2000, 900000, EvictionPolicy.LRU); // 15 min TTL
  }

  // Proof caching
  cacheProof(id: string, proof: any): void {
    this.proofCache.cacheProof(id, proof);
  }

  getProof(id: string): any | undefined {
    return this.proofCache.getProof(id);
  }

  invalidateProofs(maxAgeMs?: number): number {
    if (maxAgeMs) {
      return this.proofCache.invalidateProofsByAge(maxAgeMs);
    }
    this.proofCache.clear();
    return this.proofCache.size();
  }

  // Stream caching
  cacheStream(streamId: string, stream: any): void {
    this.streamCache.cacheStream(streamId, stream);
  }

  getStream(streamId: string): any | undefined {
    return this.streamCache.getStream(streamId);
  }

  invalidateStreams(status?: string): number {
    return this.streamCache.invalidateStreamsByStatus(status);
  }

  // Result caching
  cacheResult(key: string, result: any, ttlMs?: number): void {
    this.resultCache.set(key, result, ttlMs);
  }

  getResult(key: string): any | undefined {
    return this.resultCache.get(key);
  }

  invalidateResults(predicate?: (key: string) => boolean): number {
    if (predicate) {
      return this.resultCache.invalidate((key) => predicate(key));
    }
    this.resultCache.clear();
    return this.resultCache.size();
  }

  // Statistics
  getStats(): {
    proofs: CacheStats;
    streams: CacheStats;
    results: CacheStats;
  } {
    return {
      proofs: this.proofCache.getStats(),
      streams: this.streamCache.getStats(),
      results: this.resultCache.getStats(),
    };
  }

  // Cleanup
  destroy(): void {
    this.proofCache.destroy();
    this.streamCache.destroy();
    this.resultCache.destroy();
  }
}
