import { rateLimiter } from './rateLimiter';

function setup(max = 10, perMs = 60000) {
  let now = 1_000_000;
  const limiter = rateLimiter(max, perMs, () => now);
  return { limiter, advance: (ms: number) => (now += ms) };
}

test('the first requests of the window start at once', () => {
  const { limiter } = setup();
  for (let i = 0; i < 10; i++) expect(limiter.reserve()).toBe(0);
});

test('the 11th request of a minute waits until the first one is a minute old', () => {
  const { limiter, advance } = setup();
  for (let i = 0; i < 10; i++) {
    limiter.reserve();
    advance(1000); // ten requests in ten seconds
  }
  expect(limiter.reserve()).toBe(50000); // the first was 10 s ago: 50 s left
});

test('requests reserved at the same time are spaced, never more than 10 in a minute', () => {
  const { limiter } = setup();
  const waits = Array.from({ length: 12 }, () => limiter.reserve());
  expect(waits.slice(0, 10)).toEqual(Array(10).fill(0));
  expect(waits[10]).toBe(60000);
  expect(waits[11]).toBe(60000);
});

test('the window slides: a slot frees a minute after its request', () => {
  const { limiter, advance } = setup(2, 60000);
  limiter.reserve();
  advance(30000);
  limiter.reserve();
  expect(limiter.reserve()).toBe(30000);
  advance(60001);
  expect(limiter.reserve()).toBe(0);
});
