// Measures how well /api/frames finds issues, against hand labels in eval/labels.json.
// Each label lists categories that must be found (expect) and ones that are fine either way (allow).
// Anything else the model reports counts as a false alarm.
//   node scripts/eval-detect.mjs [--url http://localhost:3000] [--confirm 1] [--precise 0] [--every 15] [--only curb]
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    confirm: { type: 'string', default: '1' },
    precise: { type: 'string', default: '0' },
    every: { type: 'string', default: '15' }, // seconds between calls (free-tier pace)
    only: { type: 'string' },
  },
});

// One photo: which expected categories were found, which were missed, and which were false alarms.
export function scoreOne(label, found) {
  const ok = new Set([...label.expect, ...label.allow]);
  return {
    hits: label.expect.filter((c) => found.includes(c)),
    misses: label.expect.filter((c) => !found.includes(c)),
    falseAlarms: [...new Set(found.filter((c) => !ok.has(c)))],
  };
}

assert.deepEqual(scoreOne({ expect: ['pothole'], allow: ['broken_curb'] }, ['pothole', 'broken_curb', 'graffiti', 'graffiti']), {
  hits: ['pothole'],
  misses: [],
  falseAlarms: ['graffiti'],
});
assert.deepEqual(scoreOne({ expect: ['dumping'], allow: [] }, []).misses, ['dumping']);

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function detect(file) {
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.append('image', new Blob([await readFile(file)], { type: 'image/jpeg' }), basename(file));
    form.append('camera_id', 'eval');
    form.append('confirm', args.confirm);
    form.append('precise', args.precise);
    const res = await fetch(`${args.url}/api/frames`, { method: 'POST', body: form });
    const body = await res.json();
    if (res.ok) return body;
    if (attempt >= 3 || ![429, 502, 503].includes(res.status)) throw new Error(`${file}: ${res.status} ${body.error}`);
    console.warn(`${file}: ${res.status}, retrying in 60 s`);
    await sleep(60);
  }
}

const labels = JSON.parse(await readFile('eval/labels.json', 'utf8')).filter((l) => !args.only || l.file.includes(args.only));
const rows = [];
for (const [i, label] of labels.entries()) {
  if (i) await sleep(Number(args.every));
  let found = [];
  let error;
  try {
    const out = await detect(label.file);
    found = out.detections.map((d) => d.category);
  } catch (e) {
    error = e.message;
  }
  const row = { file: label.file, expect: label.expect, found: [...new Set(found)], error, ...scoreOne(label, found) };
  rows.push(row);
  const mark = error ? 'ERR' : row.misses.length || row.falseAlarms.length ? 'x' : 'ok';
  console.log(`${mark.padEnd(3)} ${basename(label.file)}  found=[${row.found}]${row.misses.length ? ` missed=[${row.misses}]` : ''}${row.falseAlarms.length ? ` false=[${row.falseAlarms}]` : ''}${error ? ` ${error}` : ''}`);
}

// Per-category recall (photos where it was expected and found) and false alarms (photos where it showed up uninvited).
const scored = rows.filter((r) => !r.error);
const categories = [...new Set(scored.flatMap((r) => [...r.expect, ...r.falseAlarms]))].sort();
const table = categories.map((c) => ({
  category: c,
  expected: scored.filter((r) => r.expect.includes(c)).length,
  found: scored.filter((r) => r.hits.includes(c)).length,
  falseAlarms: scored.filter((r) => r.falseAlarms.includes(c)).length,
}));
const negatives = scored.filter((r) => !r.expect.length);
const summary = {
  mode: { confirm: args.confirm, precise: args.precise },
  photos: scored.length,
  errors: rows.length - scored.length,
  expected: scored.reduce((n, r) => n + r.expect.length, 0),
  found: scored.reduce((n, r) => n + r.hits.length, 0),
  photosWithFalseAlarm: scored.filter((r) => r.falseAlarms.length).length,
  cleanPhotosFlagged: `${negatives.filter((r) => r.falseAlarms.length).length} of ${negatives.length}`,
  perCategory: table,
};
console.log(JSON.stringify(summary, null, 1));
const mode = args.precise === '1' ? 'precise' : args.confirm === '1' ? 'confirm' : 'fast';
await writeFile(`eval/results-${mode}.json`, JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 1));
