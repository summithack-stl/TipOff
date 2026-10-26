import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { CsvRows, fetchStreetReports } from './refresh/source.ts';

const HEADER = 'CALLERTYPE,DATETIMECLOSED,DATETIMEINIT,DESCRIPTION,NEIGHBORHOOD,PROBADDRESS,PROBLEMCODE,REQUESTID,SRX,SRY,STATUS,WARD';
const line = (id, code, desc = 'x') =>
  `"WEB","2026-01-03 13:28:07.32","2026-01-01 01:28:07.32","${desc}","74","8417 LOWELL ST","${code}","${id}","-10044192.98571190","4681102.83016494","CLOSED","13"`;

test('csv: quotes, doubled quotes and newlines survive any chunking', () => {
  const text = `${HEADER}\r\n${line(1, 'Illegal dumpg report', 'said ""hi"",\nthen left')}\r\n${line(2, 'Potholes - Alley')}\n`;
  for (const size of [1, 2, 7, text.length]) {
    const csv = new CsvRows();
    const rows = [];
    for (let i = 0; i < text.length; i += size) rows.push(...csv.push(text.slice(i, i + size)));
    rows.push(...csv.end());
    assert.equal(rows.length, 2, `chunk ${size}`);
    assert.equal(rows[0].DESCRIPTION, 'said "hi",\nthen left', `chunk ${size}`);
    assert.equal(rows[1].PROBLEMCODE, 'Potholes - Alley');
  }
});

// A real zip: local headers, deflated data, central directory, end record.
function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text)), n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(n.length, 26); local.writeUInt16LE(4, 28); // 4 bytes of local extra, unlike the directory's 0
    parts.push(local, n, Buffer.alloc(4), data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(data.length, 20); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + 4 + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

function server(body, ranges = true) {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    const range = init?.headers?.range;
    seen.push(range);
    if (!ranges || !range) return new Response(body, { status: 200 });
    const [, a, b] = range.match(/bytes=(\d*)-(\d*)/);
    const start = a === '' ? Math.max(0, body.length - Number(b)) : Number(a);
    const end = a === '' ? body.length - 1 : Number(b);
    return new Response(body.subarray(start, end + 1), { status: 206, headers: { 'content-range': `bytes ${start}-${end}/${body.length}` } });
  };
  return { fetchImpl, seen };
}

const csb = zip({
  '2019.csv': `${HEADER}\n${line(9, 'Illegal dumpg report')}\n`, // a year the app does not use
  '2024.csv': `${HEADER}\n${line(1, 'Illegal dumpg report')}\n${line(2, 'Public Nuisance Rpt')}\n`,
  '2025.csv': `${HEADER}\n${line(3, 'Graffiti-Public')}\n${line(1, 'Illegal dumpg report')}\n`, // id 1 again
  '2026.csv': `${HEADER}\n${line(4, 'Potholes - Alley')}`,
});

test('fetch: reads only the years it needs, by byte range, and cleans them', async () => {
  const { fetchImpl, seen } = server(csb);
  const { reports, stats } = await fetchStreetReports('https://city.example/csb.zip', fetchImpl);
  assert.deepEqual(reports.map((r) => r.id), ['1', '3', '4']);
  assert.deepEqual(stats, { ranged: true, rows: 5, kept: 3, byType: { dumping: 1, graffiti: 1, pothole: 1 } });
  assert.ok(seen.every((r) => r), 'every request is a range');
});

test('fetch: falls back to one full download when the server ignores ranges', async () => {
  const { fetchImpl } = server(csb, false);
  const { reports, stats } = await fetchStreetReports('https://city.example/csb.zip', fetchImpl);
  assert.equal(stats.ranged, false);
  assert.equal(reports.length, 3);
});

test('fetch: a missing year or an error page is a failure, not an empty refresh', async () => {
  await assert.rejects(fetchStreetReports('u', server(zip({ '2024.csv': HEADER })).fetchImpl), /no 2025\.csv inside/);
  await assert.rejects(fetchStreetReports('u', async () => new Response('down', { status: 503 })), /answered 503/);
  await assert.rejects(fetchStreetReports('u', server(Buffer.from('<html>maintenance</html>')).fetchImpl), /not a zip/);
});
