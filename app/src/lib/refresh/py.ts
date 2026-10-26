// The pandas and numpy behaviours the nightly build depends on, so the TypeScript port of
// data/scripts/*.py gives the same answers: half-to-even rounding, Python's own round(), pairwise
// summation for means, the smallest value winning a tied mode, and average ranks for ties.
// No imports, so node:test loads it directly.

/** numpy.round: rint(x * 10^d) / 10^d, ties to even. */
export function npRound(x: number, decimals = 0): number {
  const f = 10 ** decimals;
  const y = x * f;
  const fl = Math.floor(y);
  const diff = y - fl;
  const r = diff > 0.5 ? fl + 1 : diff < 0.5 ? fl : fl % 2 === 0 ? fl : fl + 1;
  return decimals ? r / f : r;
}

/** Python's builtin round(x, d) on a float: correctly rounded, exact ties to even. */
export function pyRound(x: number, decimals: number): number {
  const exact = Math.abs(x).toFixed(Math.min(100, decimals + 30));
  const [whole, frac] = exact.split(".");
  const kept = whole + frac.slice(0, decimals);
  const rest = frac.slice(decimals);
  let n = BigInt(kept);
  const half = "5".padEnd(rest.length, "0");
  if (rest > half || (rest === half && n % BigInt(2) === BigInt(1))) n += BigInt(1);
  const s = n.toString().padStart(decimals + 1, "0");
  const out = Number(decimals ? `${s.slice(0, -decimals)}.${s.slice(-decimals)}` : s);
  return x < 0 ? -out : out;
}

/** numpy's pairwise summation, which pandas uses for a mean. */
export function npSum(xs: number[], from = 0, n = xs.length): number {
  if (n < 8) {
    let s = 0;
    for (let i = from; i < from + n; i++) s += xs[i];
    return s;
  }
  if (n <= 128) {
    const r = xs.slice(from, from + 8);
    let i = 8;
    for (; i < n - (n % 8); i += 8) for (let k = 0; k < 8; k++) r[k] += xs[from + i + k];
    let s = r[0] + r[1] + (r[2] + r[3]) + (r[4] + r[5] + (r[6] + r[7]));
    for (; i < n; i++) s += xs[from + i];
    return s;
  }
  let half = Math.floor(n / 2);
  half -= half % 8;
  return npSum(xs, from, half) + npSum(xs, from + half, n - half);
}

export const mean = (xs: number[]) => npSum(xs) / xs.length;

/** pandas Series.mode().iat[0]: the most frequent value, the smallest one on a tie. */
export function mode<T extends string | number>(xs: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: T | undefined;
  let bestN = 0;
  for (const [x, n] of counts) if (n > bestN || (n === bestN && best !== undefined && x < best)) [best, bestN] = [x, n];
  return best;
}

/** pandas rank(pct=True): average rank of ties, divided by the count. */
export function pctRank(xs: number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j < order.length && order[j][0] === order[i][0]) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) out[order[k][1]] = avg / xs.length;
    i = j;
  }
  return out;
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
