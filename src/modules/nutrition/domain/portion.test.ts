import { energySplit, netCarbs } from './portion';

describe('netCarbs', () => {
  const macros = { kcal: 200, protein: 5, carbs: 30, fat: 2 };

  test('the carbohydrates minus the fibre', () => {
    expect(netCarbs(macros, { fiber: 4.5 })).toEqual({ grams: 25.5, partial: false });
  });

  test('never below zero, whatever the fibre', () => {
    expect(netCarbs(macros, { fiber: 31 })).toEqual({ grams: 0, partial: false });
  });

  test('without the fibre they are the carbohydrates, and partial', () => {
    expect(netCarbs(macros, {})).toEqual({ grams: 30, partial: true });
    expect(netCarbs(macros, undefined)).toEqual({ grams: 30, partial: true });
  });

  test('a zero fibre is a known fibre', () => {
    expect(netCarbs(macros, { fiber: 0 })).toEqual({ grams: 30, partial: false });
  });
});

describe('energySplit', () => {
  test('shares the energy at 4, 4 and 9 kcal a gram, to a total of 100', () => {
    // 20 g of protein = 80 kcal, 30 g of net carbs = 120 kcal, 10 g of fat = 90 kcal: 290 kcal.
    expect(energySplit(20, 30, 10)).toEqual({ proteinPct: 28, carbsPct: 41, fatPct: 31 });
  });

  test('always adds up to 100', () => {
    for (const [p, c, f] of [[1, 1, 1], [7, 13, 3], [33, 33, 33], [0.5, 80, 0.2]]) {
      const { proteinPct, carbsPct, fatPct } = energySplit(p, c, f)!;
      expect(proteinPct + carbsPct + fatPct).toBe(100);
    }
  });

  test('never has a negative share, even when a macro gives no energy and the others end in a half', () => {
    // 1 g of protein and 7 g of net carbs: 4 kcal and 28 kcal, 12.5 % and 87.5 %.
    const { proteinPct, carbsPct, fatPct } = energySplit(1, 7, 0)!;
    expect(fatPct).toBe(0);
    expect(proteinPct + carbsPct).toBe(100);
    for (let p = 0; p <= 10; p += 0.5) for (let c = 0; c <= 10; c += 0.5) {
      if (p + c === 0) continue;
      const split = energySplit(p, c, 0)!;
      expect(split.fatPct).toBe(0);
      expect(split.proteinPct + split.carbsPct).toBe(100);
    }
  });

  test('has no share when there is no energy', () => {
    expect(energySplit(0, 0, 0)).toBeUndefined();
  });
});
