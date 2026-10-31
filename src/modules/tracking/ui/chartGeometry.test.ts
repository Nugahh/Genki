import { barPath, runsOf } from './chartGeometry';

test('a bar stands on its baseline with a flat base and rounded top corners', () => {
  expect(barPath(10, 100, 20, 50, 4)).toBe('M10,100 V54 Q10,50 14,50 H26 Q30,50 30,54 V100 Z');
});

test('a bar lower than its radius does not curl over itself', () => {
  expect(barPath(10, 100, 20, 2, 4)).toBe('M10,100 V100 Q10,98 12,98 H28 Q30,98 30,100 V100 Z');
});

test('values are cut into runs wherever a day has no record', () => {
  const p = (value?: number) => ({ value });
  expect(runsOf([p(1), p(2), p(), p(), p(3), p()]).map((run) => run.map((x) => x.value))).toEqual([[1, 2], [3]]);
  expect(runsOf([p(), p()])).toEqual([]);
});
