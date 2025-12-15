
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryable: () => true,
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!opts.retryable(error)) {
        throw error;
      }
      
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createOpenAIRetry(options: RetryOptions = {}) {
  return <T>(fn: () => Promise<T>): Promise<T> => {
    return retry(fn, {
      maxAttempts: 4,
      initialDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryable: (error) => {
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          return (
            message.includes("429") ||
            message.includes("500") ||
            message.includes("503") ||
            message.includes("timeout") ||
            message.includes("network") ||
            message.includes("connection")
          );
        }
        return false;
      },
      ...options,
    });
  };
}

