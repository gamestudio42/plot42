/** Bounded worker requests: every waiter settles on reply, timeout or failure. */
export class RpcInbox<TFrom> {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (message: TFrom) => void;
      reject: (error: Error) => void;
    }
  >();
  private readonly init = new Set<{ resolve: () => void; reject: (error: Error) => void }>();

  constructor(private readonly timeoutMs = 15_000) {}

  waitInit(start: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        this.init.delete(waiter);
        if (error) reject(error);
        else resolve();
      };
      const waiter = { resolve: () => finish(), reject: (error: Error) => finish(error) };
      const timer = setTimeout(
        () => finish(new Error('Worker initialization timed out')),
        this.timeoutMs,
      );
      this.init.add(waiter);
      try {
        start();
      } catch (error) {
        finish(asError(error));
      }
    });
  }

  resolveInit(): void {
    for (const waiter of this.init) waiter.resolve();
  }

  rejectAll(error: Error): void {
    for (const waiter of this.init) waiter.reject(error);
    for (const waiter of this.pending.values()) waiter.reject(error);
  }

  request<T>(send: (id: number) => void, pick: (message: TFrom) => T | undefined): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.pending.delete(id);
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error('Worker request timed out')), this.timeoutMs);
      this.pending.set(id, {
        resolve: (message) => {
          try {
            const value = pick(message);
            if (value === undefined) throw new Error('Unexpected worker reply');
            cleanup();
            resolve(value);
          } catch (error) {
            fail(asError(error));
          }
        },
        reject: fail,
      });
      try {
        send(id);
      } catch (error) {
        fail(asError(error));
      }
    });
  }

  settle(id: number, message: TFrom): boolean {
    const waiter = this.pending.get(id);
    if (!waiter) return false;
    waiter.resolve(message);
    return true;
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function emitListeners<T extends object>(
  listeners: Iterable<T>,
  key: keyof T,
  ...args: unknown[]
): void {
  for (const listener of listeners) {
    const fn = listener[key] as ((...a: unknown[]) => void) | undefined;
    fn?.(...args);
  }
}
