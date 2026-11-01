import { NUTRIENTS, nutrientsFor, scaleNutrients, sumNutrients } from './nutrients';

describe('the catalogue', () => {
  test('has 26 distinct nutrients, grouped', () => {
    expect(NUTRIENTS).toHaveLength(26);
    expect(new Set(NUTRIENTS.map((n) => n.id)).size).toBe(26);
    const count = (group: string) => NUTRIENTS.filter((n) => n.group === group).length;
    expect([count('vitamins'), count('minerals'), count('fiber'), count('limit')]).toEqual([12, 10, 1, 3]);
  });

  test('names the units the Ciqual table gives', () => {
    const unit = (id: string) => NUTRIENTS.find((n) => n.id === id)?.unit;
    expect([unit('fiber'), unit('vitD'), unit('vitC'), unit('iodine'), unit('salt')]).toEqual(['g', 'µg', 'mg', 'µg', 'g']);
  });
});

describe('nutrientsFor and scaleNutrients', () => {
  test('a portion holds three significant digits', () => {
    expect(nutrientsFor({ vitC: 12.3456, iron: 0.00123 }, 50)).toEqual({ vitC: 6.17, iron: 0.000615 });
    expect(nutrientsFor({ potassium: 2340 }, 3)).toEqual({ potassium: 70.2 });
  });

  test('an absent nutrient stays absent, a zero stays zero', () => {
    expect(nutrientsFor({ salt: 0 }, 120)).toEqual({ salt: 0 });
    expect(nutrientsFor({}, 120)).toEqual({});
  });

  test('scaling from the frozen values of an entry', () => {
    expect(scaleNutrients({ vitC: 6.17, iron: 1 }, 50, 100)).toEqual({ vitC: 12.3, iron: 2 });
    expect(scaleNutrients(scaleNutrients({ calcium: 120 }, 100, 250), 250, 100)).toEqual({ calcium: 120 });
  });
});

describe('sumNutrients', () => {
  test('adds each nutrient over the entries', () => {
    expect(sumNutrients([{ vitC: 10, iron: 1.1 }, { vitC: 5.5, iron: 2.2 }]).totals).toEqual({ vitC: 15.5, iron: 3.3 });
  });

  test('a nutrient that one entry lacks is incomplete, the others are not', () => {
    const { totals, incomplete } = sumNutrients([{ vitC: 10, iron: 1 }, { vitC: 5 }]);
    expect(totals).toEqual({ vitC: 15, iron: 1 });
    expect(incomplete).toContain('iron');
    expect(incomplete).not.toContain('vitC');
  });

  test('an entry with no nutrients at all makes every nutrient incomplete', () => {
    const { incomplete } = sumNutrients([{ vitC: 10 }, undefined]);
    expect(incomplete).toHaveLength(26);
  });

  test('no entry: no totals and nothing incomplete', () => {
    expect(sumNutrients([])).toEqual({ totals: {}, incomplete: [] });
  });
});
