import { calorieColor, expectedProgress, isOverGoal, paceColor, type GaugeColor } from './gauge';

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

describe('calorieColor', () => {
  const GOAL = 2000;
  test.each<[number, number, GaugeColor]>([
    [2000, 23, 'green'], // pace 1.0
    [2100, 23, 'green'], // exactly 105 %: not above
    [2101, 23, 'orange'],
    [2200, 23, 'orange'], // exactly 110 %: not above
    [2201, 23, 'red'],
    [900, 15, 'green'], // no overshoot: the pace decides; 15 h expects half the goal, 900 / 1 000 = 0.9
    [600, 15, 'orange'], // pace 0.6
    [500, 15, 'red'], // pace 0.5
  ])('%s kcal at %s h is %s', (value, hour, color) => {
    expect(calorieColor(value, GOAL, hour)).toBe(color);
  });

  test('without a goal, only the pace rule applies', () => {
    expect(calorieColor(100, 0, 12)).toBe('green');
  });
});

describe('isOverGoal', () => {
  test('is true above 105 % of the goal, and never without a goal', () => {
    expect(isOverGoal(2100, 2000)).toBe(false); // exactly 105 %
    expect(isOverGoal(2101, 2000)).toBe(true);
    expect(isOverGoal(100, 0)).toBe(false);
  });
});

describe('calorieColor by goal mode', () => {
  test('a deficit is not late for eating less: only going over counts', () => {
    expect(calorieColor(400, 2000, 20, 'deficit')).toBe('green'); // 20 % at 20 h: far behind the pace
    expect(calorieColor(2000, 2000, 20, 'deficit')).toBe('green');
    expect(calorieColor(2110, 2000, 20, 'deficit')).toBe('orange');
    expect(calorieColor(2230, 2000, 20, 'deficit')).toBe('red');
  });

  test('keeping the weight is the pace and the overshoot, as before', () => {
    expect(calorieColor(400, 2000, 20, 'maintenance')).toBe('red');
    expect(calorieColor(2110, 2000, 20, 'maintenance')).toBe('orange');
    expect(calorieColor(400, 2000, 20)).toBe('red'); // no mode: maintenance
  });

  test('gaining is the pace alone: going over is fine', () => {
    expect(calorieColor(400, 2000, 20, 'surplus')).toBe('red');
    expect(calorieColor(2500, 2000, 20, 'surplus')).toBe('green');
  });
});
