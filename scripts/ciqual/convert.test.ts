import { convertCiqual } from './convert';

const alim = (rows: [string, string][]) =>
  `<TABLE>${rows.map(([id, name]) => `<ALIM><alim_code> ${id} </alim_code><alim_nom_fr> ${name} </alim_nom_fr></ALIM>`).join('')}</TABLE>`;

const compo = (rows: [string, string, string][]) =>
  `<TABLE>${rows
    .map(([id, code, t]) => `<COMPO><alim_code> ${id} </alim_code><const_code> ${code} </const_code><teneur> ${t} </teneur><min missing=" " /></COMPO>`)
    .join('')}</TABLE>`;

const KCAL = '328';
const PROTEIN = '25003';
const CARBS = '31000';
const FAT = '40000';
const ALCOHOL = '60000';

const byId = (foods: ReturnType<typeof convertCiqual>) => Object.fromEntries(foods.map((f) => [f.id, f]));

test('reads the four macros with decimal commas and decodes entities in the name', () => {
  const foods = convertCiqual(
    alim([['9100', 'Riz blanc, cru'], ['4003', 'Pomme de terre, bouillie/cuite à l&apos;eau']]),
    compo([
      ['9100', KCAL, '354'], ['9100', PROTEIN, '7,1'], ['9100', CARBS, '78,5'], ['9100', FAT, '0,6'],
      ['4003', KCAL, '80'], ['4003', PROTEIN, '2'], ['4003', CARBS, '16'], ['4003', FAT, '0,1'],
    ]),
  );
  expect(byId(foods)['9100']).toEqual({
    id: '9100', name: 'Riz blanc, cru', search: 'riz blanc cru', state: 'raw', kcal: 354, protein: 7.1, carbs: 78.5, fat: 0.6,
  });
  expect(byId(foods)['4003'].name).toBe("Pomme de terre, bouillie/cuite à l'eau");
  expect(byId(foods)['4003'].state).toBe('cooked');
});

test('"traces" and "< x" count as 0, "-" counts as 0 for protein, carbs and fat', () => {
  const [food] = convertCiqual(
    alim([['1', 'Eau minérale']]),
    compo([['1', KCAL, '0'], ['1', PROTEIN, '&lt; 0,5'], ['1', CARBS, 'traces'], ['1', FAT, '-']]),
  );
  expect(food).toMatchObject({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test('estimates the energy with Atwater factors when Ciqual gives none but every macro is known', () => {
  const [food] = convertCiqual(
    alim([['2', 'Pain maison']]),
    compo([['2', KCAL, '-'], ['2', PROTEIN, '20'], ['2', CARBS, '10'], ['2', FAT, '5'], ['2', ALCOHOL, '0']]),
  );
  expect(food.kcal).toBe(165); // 4 × 20 + 4 × 10 + 9 × 5
});

test('drops a food whose energy is missing and some macro is undetermined (a floor is not an estimate)', () => {
  const macros = [PROTEIN, CARBS, FAT, ALCOHOL];
  for (const undetermined of macros) {
    const rows = macros.map((code): [string, string, string] => ['2', code, code === undetermined ? '-' : '5']);
    expect(convertCiqual(alim([['2', 'Boeuf, jarret cru']]), compo([['2', KCAL, '-'], ...rows]))).toEqual([]);
  }
});

test('"traces" and "< x" count as known zeros, and decimals are rounded to 0.1', () => {
  const [food] = convertCiqual(
    alim([['3', 'Huile aromatisée']]),
    compo([['3', KCAL, '-'], ['3', PROTEIN, 'traces'], ['3', CARBS, '&lt; 0,5'], ['3', FAT, '0'], ['3', ALCOHOL, '0']]),
  );
  expect(food).toMatchObject({ kcal: 0, protein: 0, carbs: 0, fat: 0 }); // kept: they are determined, not unknown
  const [rounded] = convertCiqual(
    alim([['4', 'X']]),
    compo([['4', KCAL, '100,04'], ['4', PROTEIN, '7,38'], ['4', CARBS, '12,34'], ['4', FAT, '0,56']]),
  );
  expect(rounded).toMatchObject({ kcal: 100, protein: 7.4, carbs: 12.3, fat: 0.6 });
});

test('an unrecognised or blank teneur throws instead of becoming a guess', () => {
  const convert = (teneur: string) => convertCiqual(alim([['6', 'X']]), compo([['6', FAT, teneur]]));
  expect(() => convert('abc')).toThrow('unrecognised Ciqual value: "abc"');
  expect(() => convert('')).toThrow('unrecognised Ciqual value: ""');
});

test('names come out in NFC, entities decoded and repeated spaces collapsed', () => {
  const nfd = 'Sardine,  grillée/poêlée à l&apos;huile'.normalize('NFD');
  const [food] = convertCiqual(alim([['5', nfd]]), compo([['5', KCAL, '100']]));
  expect(food.name).toBe("Sardine, grillée/poêlée à l'huile");
  expect(food.state).toBe('cooked');
});

test('counts alcohol (7 kcal/g) in the estimate', () => {
  const [food] = convertCiqual(
    alim([['3', 'Gin']]),
    compo([['3', KCAL, '-'], ['3', PROTEIN, '0'], ['3', CARBS, '0'], ['3', FAT, '0'], ['3', ALCOHOL, '40']]),
  );
  expect(food.kcal).toBe(280);
});

test('drops a food with no energy and no macro at all', () => {
  const foods = convertCiqual(
    alim([['4', 'Mystère']]),
    compo([['4', KCAL, '-'], ['4', PROTEIN, '-'], ['4', CARBS, '-'], ['4', FAT, '-']]),
  );
  expect(foods).toEqual([]);
});

test.each([
  ['Carotte, crue', 'raw'],
  ['Poulet, filet sans peau grillé/poêlé', 'cooked'],
  ['Pâtes sèches, standard, cuites, sans sel ajouté', 'cooked'],
  ['Riz blanc, précuit, cuit, sans sel ajouté', 'cooked'],
  ['Pomme de terre noisette, surgelée, à cuire', 'other'],
  ['Oeuf cru ou cuit', 'other'],
  ['Banane, pulpe, crue', 'raw'],
  ['Yaourt nature', 'other'],
])('%s is %s', (name, state) => {
  const [food] = convertCiqual(alim([['1', name]]), compo([['1', KCAL, '100']]));
  expect(food.state).toBe(state);
});
