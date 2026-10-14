// Finds street photos of the highest-risk vacant buildings on Mapillary, aims each one at the building,
// optionally runs hazard detection, and writes app/public/photos/ for the app.
//
//   MAPILLARY_TOKEN=MLY|... node scripts/fetch-building-photos.mjs [--top 1500] [--max 30] [--detect http://localhost:3000]
//   MAPILLARY_TOKEN=MLY|... node scripts/fetch-building-photos.mjs --source hotspots --top 300 --max 20 [--detect ...]
//   node scripts/fetch-building-photos.mjs --redetect --detect http://localhost:3000 [--confirm 1]   (re-run detection on saved photos only)
//
// Photos are Mapillary imagery, CC BY-SA 4.0: index.json keeps the image id and a link for attribution.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const { values: args } = parseArgs({
  options: {
    source: { type: 'string', default: 'buildings' }, // 'buildings' or 'hotspots' (311 hotspots, dumping first)
    top: { type: 'string', default: '1500' }, // how many of the highest-ranked targets to search
    max: { type: 'string', default: '30' }, // how many buildings to save photos for
    detect: { type: 'string' }, // app URL: also run /api/frames on each photo
    every: { type: 'string', default: '15' }, // seconds between detection calls (free-tier pace)
    confirm: { type: 'string', default: '0' }, // 1 = second model double-checks (slower, fewer false alarms)
    precise: { type: 'string', default: '0' }, // 1 = second model does the whole photo (slowest, tightest boxes)
    redetect: { type: 'boolean', default: false },
    featured: { type: 'boolean', default: false }, // with --redetect: only entries marked featured
  },
});
const token = process.env.MAPILLARY_TOKEN;
if (!token && !args.redetect) throw new Error('MAPILLARY_TOKEN is not set');

const appDir = join(import.meta.dirname, '..');
const outDir = join(appDir, 'public', 'photos');
const indexFile = join(outDir, 'index.json');
await mkdir(outDir, { recursive: true });
const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'));
const readIndex = () => readJSON(indexFile).catch(() => []);

// Each target is a place to photograph: key names the files, info goes into its index entry.
async function loadTargets() {
  if (args.source === 'buildings') {
    const buildings = await readJSON(join(appDir, 'data', 'clean', 'vacant_buildings.json'));
    return buildings.map((b) => ({
      key: b.handle, lat: b.lat, lon: b.lon, label: `rank ${b.risk_rank} ${b.address}`,
      info: { handle: b.handle, address: b.address, lat: b.lat, lon: b.lon, ward: b.ward,
        risk_score: b.risk_score, risk_rank: b.risk_rank, risk_reasons: b.risk_reasons },
    }));
  }
  if (args.source !== 'hotspots') throw new Error(`unknown --source ${args.source}`);
  // hotspots.json is sorted by score; dumping goes first because it is the problem set.
  const hotspots = await readJSON(join(appDir, 'data', 'clean', 'hotspots.json'));
  const ordered = [...hotspots.filter((h) => h.category === 'dumping'), ...hotspots.filter((h) => h.category !== 'dumping')];
  return ordered.map((h) => ({
    key: h.id, lat: h.lat, lon: h.lon, label: `${h.category} #${h.rank} ${h.top_address}`,
    info: { hotspot_id: h.id, category: h.category, address: h.top_address, lat: h.lat, lon: h.lon, ward: h.ward,
      score: h.score, rank: h.rank, reasons: h.reasons },
  }));
}

const rad = Math.PI / 180;
function bearing(from, to) {
  const y = Math.sin((to.lon - from.lon) * rad) * Math.cos(to.lat * rad);
  const x = Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lon - from.lon) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
const relAngle = (a, b) => ((a - b + 540) % 360) - 180; // signed difference in -180..180

async function graph(path) {
  const res = await fetch(`https://graph.mapillary.com/${path}`, { headers: { Authorization: `OAuth ${token}` } });
  if (!res.ok) throw new Error(`Mapillary ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Usable = a 360 photo (we can turn it toward the building) or a normal photo already facing it.
function usable(img, b) {
  const [lon, lat] = img.computed_geometry?.coordinates ?? img.geometry.coordinates;
  // computed_compass_angle is Mapillary's corrected heading; the raw compass can be off by 100+ degrees.
  const rel = relAngle(bearing({ lat, lon }, b), img.computed_compass_angle ?? img.compass_angle ?? 0);
  const meters = Math.hypot((b.lat - lat) * 111_000, (b.lon - lon) * 87_000);
  return img.is_pano || Math.abs(rel) <= 45 ? { ...img, rel, meters } : null;
}

async function findPhotos(b) {
  const fields = 'id,captured_at,compass_angle,computed_compass_angle,is_pano,geometry,computed_geometry,thumb_2048_url';
  const { data } = await graph(`images?fields=${fields}&lat=${b.lat}&lng=${b.lon}&radius=50&limit=100`);
  const year = (img) => new Date(img.captured_at).getFullYear();
  // Closest usable photo wins: the building is biggest and least blocked there.
  const pick = (imgs) => imgs.map((i) => usable(i, b)).filter(Boolean).sort((a, c) => a.meters - c.meters)[0];
  const after = pick(data.filter((i) => year(i) >= 2024));
  const before = pick(data.filter((i) => year(i) <= 2019));
  return after ? { after, before } : null;
}

// For a 360 photo, cut a ~100 degree window centered on the building. The center column faces compass_angle.
async function aimedJpeg(img) {
  const buf = Buffer.from(await (await fetch(img.thumb_2048_url)).arrayBuffer());
  if (!img.is_pano) return sharp(buf).resize({ width: 1280 }).jpeg({ quality: 78 }).toBuffer();
  const { width: W, height: H } = await sharp(buf).metadata();
  const cropW = Math.round((W * 100) / 360);
  let left = Math.round(W * (0.5 + img.rel / 360) - cropW / 2);
  left = ((left % W) + W) % W;
  // Two copies side by side so a window that wraps past the right edge is still one rectangle.
  const doubled = await sharp({ create: { width: W * 2, height: H, channels: 3, background: '#000' } })
    .composite([{ input: buf, left: 0, top: 0 }, { input: buf, left: W, top: 0 }])
    .jpeg()
    .toBuffer();
  return sharp(doubled)
    .extract({ left, top: Math.round(H * 0.22), width: cropW, height: Math.round(H * 0.45) })
    .resize({ width: 1280 })
    .jpeg({ quality: 78 })
    .toBuffer();
}

async function detect(file) {
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.append('image', new Blob([await readFile(join(outDir, file))], { type: 'image/jpeg' }), file);
    form.append('camera_id', 'mapillary');
    form.append('confirm', args.confirm);
    form.append('precise', args.precise);
    const res = await fetch(`${args.detect}/api/frames`, { method: 'POST', body: form });
    const body = await res.json();
    if (res.ok) return body;
    // Free tiers return 429/503 under load: wait and retry a few times before giving up.
    if (attempt === 4) throw new Error(body.error);
    console.warn(`  ${file}: ${String(body.error).slice(0, 80)} (retry ${attempt} in 45 s)`);
    await new Promise((r) => setTimeout(r, 45_000));
  }
}

const pause = (started) => new Promise((r) => setTimeout(r, Math.max(0, Number(args.every) * 1000 - (Date.now() - started))));

if (args.redetect) {
  if (!args.detect) throw new Error('--redetect needs --detect <app url>');
  const saved = await readIndex();
  for (const [i, entry] of saved.entries()) {
    if (args.featured && !entry.featured) continue;
    const started = Date.now();
    try {
      entry.after.detections = (await detect(entry.after.file)).detections;
      console.log(`${i + 1}/${saved.length} ${entry.address}: ${entry.after.detections.length} hazards`);
    } catch (error) {
      console.warn(`  detect ${entry.after.file}: ${error.message}`);
    }
    await writeFile(indexFile, JSON.stringify(saved, null, 1));
    await pause(started);
  }
  process.exit(0);
}

const targets = (await loadTargets()).slice(0, Number(args.top));
// A hotspot run adds to the building photos instead of replacing them (and replaces earlier hotspot photos).
const index = args.source === 'hotspots' ? (await readIndex()).filter((e) => !e.hotspot_id) : [];
let added = 0;
for (const b of targets) {
  if (added >= Number(args.max)) break;
  let found;
  try {
    found = await findPhotos(b);
  } catch (error) {
    console.warn(`  ${b.label}: ${error.message}`);
    continue;
  }
  if (!found) continue;

  const entry = {
    ...b.info,
    attribution: 'Street imagery: Mapillary contributors, CC BY-SA 4.0',
  };
  for (const which of ['after', 'before']) {
    const img = found[which];
    if (!img) continue;
    const year = new Date(img.captured_at).getFullYear();
    const file = `${b.key}-${year}.jpg`;
    await writeFile(join(outDir, file), await aimedJpeg(img));
    entry[which] = {
      file, year, image_id: img.id, pano: Boolean(img.is_pano), meters: Math.round(img.meters),
      link: `https://www.mapillary.com/app/?pKey=${img.id}`,
    };
  }
  if (args.detect) {
    const started = Date.now();
    try {
      const { detections } = await detect(entry.after.file);
      entry.after.detections = detections;
    } catch (error) {
      console.warn(`  detect ${entry.after.file}: ${error.message}`);
    }
    await pause(started);
  }
  index.push(entry);
  added += 1;
  // Save as we go so an interrupted run keeps its work.
  await writeFile(indexFile, JSON.stringify(index, null, 1));
  console.log(`${added}. ${b.label}: ${entry.after.year}${entry.before ? ` + ${entry.before.year}` : ''}${entry.after.detections ? `, ${entry.after.detections.length} hazards` : ''}`);
}
console.log(`wrote ${indexFile} (${added} new ${args.source}, ${index.length} entries)`);
