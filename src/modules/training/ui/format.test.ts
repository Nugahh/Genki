import { asText, kgText, parseNumber, setsText } from './format';

const sets = (reps: number[], kg: number | number[]) => reps.map((r, i) => ({ exerciseId: 'x', setNo: i + 1, reps: r, kg: Array.isArray(kg) ? kg[i] : kg }));

test('kgText writes a load the French way, without a useless decimal', () => {
  expect(kgText(20)).toBe('20 kg');
  expect(kgText(22.5)).toBe('22,5 kg');
  expect(kgText(1250)).toBe(`${(1250).toLocaleString('fr-FR')} kg`); // fr-FR groups thousands with a narrow no-break space
});

test('setsText sums up identical sets, and lists different ones', () => {
  expect(setsText(sets([8, 8, 8], 20))).toBe('3 × 8 à 20 kg');
  expect(setsText(sets([8, 8, 6], 20))).toBe('8 × 20 kg · 8 × 20 kg · 6 × 20 kg');
  expect(setsText(sets([8, 8, 8], 0))).toBe('3 × 8');
  expect(setsText(sets([10, 8], 0))).toBe('10 · 8');
  expect(setsText([])).toBe('');
});

test('parseNumber reads a comma or a point, and nothing else as NaN', () => {
  expect(parseNumber('22,5')).toBe(22.5);
  expect(parseNumber('22.5')).toBe(22.5);
  expect(parseNumber('')).toBeNaN();
  expect(parseNumber('abc')).toBeNaN();
});

test('asText is the way back, with a comma', () => expect(asText(22.5)).toBe('22,5'));
