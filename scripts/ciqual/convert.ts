// Run by Node 24 (type stripping), so imports carry their .ts extension.
import { normalizeSearch } from '../../src/modules/nutrition/domain/normalize.ts';

export type CiqualFood = {
  id: string;
  name: string;
  search: string;
  state: 'raw' | 'cooked' | 'other';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Ciqual 2025 constituent codes (const_*.xml).
const KCAL = '328'; // Energie, Règlement UE N° 1169/2011 (kcal/100 g)
const PROTEIN = '25003'; // Protéines, N x 6.25 (g/100 g)
const CARBS = '31000'; // Glucides (g/100 g)
const FAT = '40000'; // Lipides (g/100 g)
const ALCOHOL = '60000'; // Alcool (éthanol) (g/100 g)
const WANTED = new Set([KCAL, PROTEIN, CARBS, FAT, ALCOHOL]);

// Both files list a food's fields in this order; convertCiqual's caller checks the count.
const ALIM = /<ALIM>\s*<alim_code>\s*(\d+)\s*<\/alim_code>\s*<alim_nom_fr>\s*([\s\S]*?)\s*<\/alim_nom_fr>/g;
const COMPO = /<COMPO>\s*<alim_code>\s*(\d+)\s*<\/alim_code>\s*<const_code>\s*(\d+)\s*<\/const_code>\s*<teneur>\s*([\s\S]*?)\s*<\/teneur>/g;

const ENTITIES: Record<string, string> = { apos: "'", quot: '"', lt: '<', gt: '>', amp: '&' };
const decode = (s: string) => s.replace(/&(apos|quot|lt|gt|amp);/g, (_, e: string) => ENTITIES[e]);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** A teneur as a number: "12,5" → 12.5, "traces" and "< 0,5" → 0, "-" (not determined) → undefined. Anything else throws. */
function amount(teneur: string): number | undefined {
  const t = decode(teneur).trim();
  if (t === '-') return undefined;
  if (t === 'traces' || t.startsWith('<')) return 0;
  const n = Number(t.replace(',', '.'));
  // A blank or unknown form would be silently wrong: a format change must be loud.
  if (t === '' || !Number.isFinite(n)) throw new Error(`unrecognised Ciqual value: "${teneur}"`);
  return n;
}

// \b ignores accents, so letters are delimited explicitly.
const word = (alternatives: string) => new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, 'u');
const RAW = word('cru|crue|crus|crues');
const COOKED = word(
  'cuit|cuite|cuits|cuites|bouilli|bouillie|bouillis|bouillies|grillé|grillée|grillés|grillées|rôti|rôtie|rôtis|rôties|' +
    'poêlé|poêlée|poêlés|poêlées|frit|frite|frits|frites|braisé|braisée|braisés|braisées|vapeur|sauté|sautée|sautés|sautées',
);

/** Ciqual does not link a raw food to its cooked twin: the state comes from the name. Both words → other. */
function stateOf(name: string): CiqualFood['state'] {
  const s = name.toLowerCase();
  const raw = RAW.test(s);
  const cooked = COOKED.test(s);
  if (raw === cooked) return 'other';
  return raw ? 'raw' : 'cooked';
}

/**
 * Energy in kcal/100 g: Ciqual's own, else Atwater (4/4/9, alcohol 7) but only when all four are determined:
 * an undetermined value counted as 0 would understate the calories (a floor, not an estimate).
 */
function energy(v: Record<string, number | undefined>): number | undefined {
  if (v[KCAL] !== undefined) return v[KCAL];
  const [p, c, f, a] = [v[PROTEIN], v[CARBS], v[FAT], v[ALCOHOL]];
  if (p === undefined || c === undefined || f === undefined || a === undefined) return undefined;
  return 4 * p + 4 * c + 9 * f + 7 * a;
}

export function convertCiqual(alimXml: string, compoXml: string): CiqualFood[] {
  const values = new Map<string, Record<string, number | undefined>>();
  for (const [, id, code, teneur] of compoXml.matchAll(COMPO)) {
    if (!WANTED.has(code)) continue;
    const v = values.get(id) ?? {};
    v[code] = amount(teneur);
    values.set(id, v);
  }
  const foods: CiqualFood[] = [];
  for (const [, id, rawName] of alimXml.matchAll(ALIM)) {
    const v = values.get(id) ?? {};
    const kcal = energy(v);
    if (kcal === undefined) continue;
    const name = decode(rawName).replace(/\s+/g, ' ').normalize('NFC');
    foods.push({
      id,
      name,
      search: normalizeSearch(name),
      state: stateOf(name),
      kcal: round1(kcal),
      protein: round1(v[PROTEIN] ?? 0),
      carbs: round1(v[CARBS] ?? 0),
      fat: round1(v[FAT] ?? 0),
    });
  }
  return foods;
}
