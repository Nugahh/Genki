/**
 * The promise, or `fallback` if it has not settled after `ms`: a read that waits for the network must not hold back a write that
 * does not need it (offline, a read can wait for ever). A late result is dropped.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
