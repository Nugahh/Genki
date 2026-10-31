/** A number typed with a comma or a point; NaN when empty or not a number. */
export const parseNumber = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));

/** A number as it is typed in a field, with a comma: the way back from `parseNumber`. */
export const asText = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));
