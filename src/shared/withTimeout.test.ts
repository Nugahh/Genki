import { withTimeout } from './withTimeout';

afterEach(() => jest.useRealTimers());

test('gives the result when it comes in time', async () => {
  await expect(withTimeout(Promise.resolve('read'), 1000, 'fallback')).resolves.toBe('read');
});

test('gives the fallback when the promise has not settled by then, and drops a late result', async () => {
  jest.useFakeTimers();
  let late: (v: string) => void = () => {};
  const result = withTimeout(new Promise<string>((resolve) => (late = resolve)), 1000, 'fallback');
  jest.advanceTimersByTime(1000);
  await expect(result).resolves.toBe('fallback');
  late('too late');
});

test('passes a rejection on', async () => {
  await expect(withTimeout(Promise.reject(new Error('denied')), 1000, 'fallback')).rejects.toThrow('denied');
});
