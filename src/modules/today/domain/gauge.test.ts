import { expectedProgress, paceColor, type GaugeColor } from './gauge';

describe('expectedProgress', () => {
  test.each<[number, number]>([
    [3, 0],
    [7, 0],
    [15, 0.5],
    [23, 1],
    [23.5, 1],
  ])('at %s h, %s of the goal is expected', (hour, expected) => {
    expect(expectedProgress(hour)).toBe(expected);
  });
});

describe('paceColor', () => {
  const GOAL = 2500;

  test('is green until 7 h, whatever the progress', () => {
    expect(paceColor(0, GOAL, 6.9)).toBe('green');
    expect(paceColor(0, GOAL, 7)).toBe('green');
  });

  test.each<[number, GaugeColor]>([
    [2250, 'green'], // pace 0.9
    [2249, 'orange'],
    [1500, 'orange'], // pace 0.6
    [1499, 'red'],
  ])('at 23 h, %s ml out of 2 500 is %s', (value, color) => {
    expect(paceColor(value, GOAL, 23)).toBe(color);
  });

  test('compares progress with what is expected at that hour', () => {
    // At 15 h half the goal is expected: 1 150 ml is a 0.92 pace, 1 100 ml a 0.88 pace.
    expect(paceColor(1150, GOAL, 15)).toBe('green');
    expect(paceColor(1100, GOAL, 15)).toBe('orange');
  });

  test('is green when there is no goal', () => {
    expect(paceColor(0, 0, 15)).toBe('green');
  });
});
