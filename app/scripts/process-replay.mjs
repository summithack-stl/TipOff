// Runs a clip's frames through /api/frames and writes app/public/replay/<clip>.json for the tracker overlay.
// Paced for free-tier limits. Run the dev server with DEMO_CACHE=1 so a rerun replays answers instead of re-calling the models.
//
//   node scripts/process-replay.mjs --clip drive1 [--every 15] [--step 2] [--confirm 1] [--app http://localhost:3000]
//
// Reads ../data/footage/<clip>/frames.json (written by data/scripts/extract_frames.py).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { assignIds } from '../src/lib/issues.ts';

const { values: args } = parseArgs({
  options: {
    clip: { type: 'string' },
    every: { type: 'string', default: '15' }, // seconds between AI calls (free Groq allows about 4 images a minute)
    step: { type: 'string', default: '2' }, // use every Nth extracted frame as a keyframe
    confirm: { type: 'string', default: '1' },
    app: { type: 'string', default: 'http://localhost:3000' },
  },
});
if (!args.clip) throw new Error('--clip is required');

const dir = join(import.meta.dirname, '..', '..', 'data', 'footage', args.clip);
const frames = JSON.parse(await readFile(join(dir, 'frames.json'), 'utf8')).filter((_, i) => i % Number(args.step) === 0);
const outDir = join(import.meta.dirname, '..', 'public', 'replay');
const outFile = join(outDir, `${args.clip}.json`);
await mkdir(outDir, { recursive: true });

const sleep = (s) => new Promise((resolve) => setTimeout(resolve, s * 1000));

async function detect(frame) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const form = new FormData();
    form.append('image', new Blob([await readFile(join(dir, 'frames', frame.file))], { type: 'image/jpeg' }), frame.file);
    form.append('camera_id', args.clip);
    form.append('confirm', args.confirm);
    if (frame.lat !== undefined) form.append('lat', String(frame.lat));
    if (frame.lon !== undefined) form.append('lon', String(frame.lon));
    const res = await fetch(`${args.app}/api/frames`, { method: 'POST', body: form });
    const body = await res.json();
    if (res.ok) return body;
    console.warn(`  ${frame.file}: ${res.status} ${body.error} (attempt ${attempt}, waiting 60 s)`);
    await sleep(60);
  }
  throw new Error(`${frame.file} failed 5 times`);
}

const keyframes = [];
const counter = { n: 0 };
let prev = [];
for (const [i, frame] of frames.entries()) {
  const started = Date.now();
  const { detections, ms } = await detect(frame);
  prev = assignIds(prev, detections, counter);
  keyframes.push({ t: frame.t, lat: frame.lat, lon: frame.lon, detections: prev });
  // Write after every frame so a crash or Ctrl+C keeps what is done.
  await writeFile(outFile, JSON.stringify({ clip: args.clip, video: `/replay/${args.clip}.mp4`, keyframes }, null, 1));
  console.log(`${i + 1}/${frames.length} t=${frame.t}s ${detections.length} found (${ms} ms)`);
  // Cached answers come back in a few ms: no need to wait for the rate limit then.
  if (ms > 500) await sleep(Math.max(0, Number(args.every) - (Date.now() - started) / 1000));
}
console.log(`wrote ${outFile} (${keyframes.length} keyframes, ${counter.n} tracked issues)`);
