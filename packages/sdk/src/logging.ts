/**
 * Logging Infrastructure
 * 
 * Provides structured logging with levels, formatters, and transports
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  duration?: number;
  tags?: string[];
}

export type LogFormatter = (entry: LogEntry) => string;
export type LogTransport = (formatted: string, entry: LogEntry) => void;

/**
 * Structured logger with context support
 */
export class Logger {
  private level: LogLevel;
  private transporters: LogTransport[] = [];
  private formatters: LogFormatter[] = [];
  private contextStack: Record<string, any>[] = [];

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
    this.addDefaultFormatters();
  }

  /**
   * Sets the minimum log level
   */
  setLevel(level: LogLevel | string): void {
    if (typeof level === "string") {
      this.level = LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
    } else {
      this.level = level;
    }
  }

  /**
   * Adds a log formatter
   */
  addFormatter(formatter: LogFormatter): void {
    this.formatters.push(formatter);
  }

  /**
   * Adds a log transporter
   */
  addTransport(transport: LogTransport): void {
    this.transporters.push(transport);
  }

  /**
   * Pushes context for nested logging
   */
  pushContext(context: Record<string, any>): void {
    this.contextStack.push(context);
  }

  /**
   * Pops context
   */
  popContext(): void {
    this.contextStack.pop();
  }

  /**
   * Merges all context from stack
   */
  private getContext(): Record<string, any> {
    return this.contextStack.reduce((acc, ctx) => ({ ...acc, ...ctx }), {});
  }

  /**
   * Logs a message at specified level
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    duration?: number,
  ): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      message,
      context: { ...this.getContext(), ...context },
      error,
      duration,
    };

    let formatted = message;
    for (const formatter of this.formatters) {
      formatted = formatter(entry);
    }

    for (const transport of this.transporters) {
      transport(formatted, entry);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  critical(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  /**
   * Logs with timing information
   */
  async timed<T>(
    label: string,
    fn: () => Promise<T>,
    context?: Record<string, any>,
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.info(`${label} completed`, { ...context, duration: `${duration.toFixed(2)}ms` });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed`, error instanceof Error ? error : new Error(String(error)), {
        ...context,
        duration: `${duration.toFixed(2)}ms`,
      });
      throw error;
    }
  }

  /**
   * Logs event with tags
   */
  event(name: string, tags?: string[], context?: Record<string, any>): void {
    this.info(`[EVENT] ${name}`, { ...context, tags });
  }

  /**
   * Adds default console formatter.
   */
  private addDefaultFormatters(): void {
    this.addFormatter((entry) => {
      const level = LogLevel[entry.level];
      const timestamp = new Date(entry.timestamp).toISOString();
      let message = `[${timestamp}] ${level}: ${entry.message}`;

      if (entry.context && Object.keys(entry.context).length > 0) {
        message += ` ${JSON.stringify(entry.context)}`;
      }

      if (entry.error) {
        message += `\n${entry.error.stack}`;
      }

      if (entry.duration) {
        message += ` (${entry.duration.toFixed(2)}ms)`;
      }

      return message;
    });
  }
}

/**
 * Console transport for logging to stdout/stderr
 */
export const ConsoleTransport: LogTransport = (formatted, entry) => {
  if (entry.level >= LogLevel.ERROR) {
    console.error(formatted);
  } else {
    console.log(formatted);
  }
};

/**
 * In-memory buffer transport for testing/debugging
 */
export class BufferTransport implements LogTransport {
  private buffer: string[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  __call__(formatted: string, _entry: LogEntry): void {
    this.buffer.push(formatted);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getBuffer(): string[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

export function initializeGlobalLogger(level: LogLevel = LogLevel.INFO): Logger {
  globalLogger = new Logger(level);
  globalLogger.addTransport(ConsoleTransport);
  return globalLogger;
}

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = initializeGlobalLogger();
  }
  return globalLogger;
}

/**
 * Protocol-specific logger with module context
 */
export class ProtocolLogger {
  private logger: Logger;
  private module: string;

  constructor(module: string, logger?: Logger) {
    this.module = module;
    this.logger = logger ?? getGlobalLogger();
  }

  debug(message: string, context?: Record<string, any>): void {
    this.logger.debug(message, { ...context, module: this.module });
  }

  info(message: string, context?: Record<string, any>): void {
    this.logger.info(message, { ...context, module: this.module });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.logger.warn(message, { ...context, module: this.module });
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.logger.error(message, error, { ...context, module: this.module });
  }

  async timed<T>(
    label: string,
    fn: () => Promise<T>,
    context?: Record<string, any>,
  ): Promise<T> {
    return this.logger.timed(`[${this.module}] ${label}`, fn, context);
  }

  event(name: string, tags?: string[], context?: Record<string, any>): void {
    this.logger.event(`${this.module}:${name}`, tags, context);
  }
}
