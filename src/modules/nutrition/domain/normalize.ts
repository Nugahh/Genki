/** Lower-case, accent-free text for matching: "Œuf à la coque" → "oeuf a la coque". */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
