/** A bar standing on the baseline, its top corners rounded: the data end is round, the base is flat. */
export function barPath(x: number, baseline: number, width: number, height: number, radius = 4): string {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${baseline} V${baseline - height + r} Q${x},${baseline - height} ${x + r},${baseline - height} H${x + width - r} Q${x + width},${baseline - height} ${x + width},${baseline - height + r} V${baseline} Z`;
}

/** Runs of consecutive values, so that a day with no record breaks the line instead of being drawn as zero. */
export function runsOf<T extends { value?: number }>(points: T[]): T[][] {
  const runs: T[][] = [];
  let current: T[] = [];
  for (const point of points) {
    if (point.value === undefined) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}
