// Risk 0-100 to color: grey, yellow, orange, red, deep red.
const STOPS: [number, [number, number, number]][] = [
  [0, [107, 114, 128]],
  [35, [234, 179, 8]],
  [55, [249, 115, 22]],
  [72, [220, 38, 38]],
  [90, [153, 27, 27]],
];
export function riskColor(score: number): string {
  let i = 0;
  while (i < STOPS.length - 2 && score > STOPS[i + 1][0]) i++;
  const [s0, c0] = STOPS[i];
  const [s1, c1] = STOPS[i + 1];
  const u = Math.min(1, Math.max(0, (score - s0) / (s1 - s0)));
  return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * u)).join(",")})`;
}
