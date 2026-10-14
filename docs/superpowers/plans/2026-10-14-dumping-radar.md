# Dumping Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app from "Vacant Building Danger Radar" into "Dumping Radar". It finds repeat hotspots for illegal dumping, potholes and graffiti in St. Louis 311 data, confirms them on street photos, and writes a camera and cleanup plan for each hotspot.

**Architecture:** Two Python scripts turn the city's 311 (CSB) CSVs into `street_reports.json` and `hotspots.json`. A server-only loader and a new `/api/plan` route turn one hotspot (plus optional photo detections) into a short plan via `chatJSON`. The map, side panel and crew view read `hotspots_lite.json` and call `/api/plan`. The vacant-building code stays untouched (benched); vacant buildings only show up as a hotspot factor and an optional map layer.

**Tech Stack:** Python 3 + pandas (data), Next.js App Router + TypeScript strict + zod (app), Groq/Gemini through `app/src/lib/llm.ts`, `node --test` for TS logic tests.

**Spec:** Official City of St. Louis Problem Set #3 (Illegal Dumping), in the organizer doc https://docs.google.com/document/d/1nj5HK2Dqi_PmRhdxsSn8qzen_-G88JCEaoUpCm7efnY. The city asks for:
1. better ways to identify and track down people who dump;
2. hotspots found ahead of time, plus the likely places and times offenders go, so preventive action can be targeted.

Data the city points to: CSB/311 requests, `PROBLEMCODE` = illegal dumping.

**Deadline:** Thu Oct 15, 4:30pm CT. Upload target 3:30pm.

## Global Constraints

- Only the patterns, never the people. No face recognition, no license-plate reading, no caller names. Do not save the 311 `DESCRIPTION`, `CALLERTYPE` or any free-text field.
- Report times are when residents *reported* dumping, not when it happened. UI and LLM text must say "reports mostly come in…", never "dumping happens at…".
- The score orders hotspots for a human to look at first. It is not a prediction of crime.
- App code only reads `app/data/clean/*.json`. Never call city APIs live from the app. No Python server (repo CLAUDE.md).
- LLM calls only through `app/src/lib/llm.ts`, from server code.
- TypeScript strict, no `any`, no `@ts-ignore`. Run `npm run typecheck` before every commit.
- PRs under 300 changed lines, one concern each, conventional commits (`feat:`, `fix:`, `docs:` …).
- Generated JSON over ~5 MB must not be imported into client components. The browser only gets `*_lite.json`.

## Verified facts about the 311 data (checked 2026-10-14)

- Zip: `https://www.stlouis-mo.gov/data/upload/data-files/csb.zip`, 128 MB, one CSV per year (`2008.csv` … `2026.csv`) plus `README.txt`. All values are quoted strings.
- Columns: `CALLERTYPE, CITY, DATECANCELLED, DATEINVTDONE, DATETIMECLOSED, DATETIMEINIT, DESCRIPTION, EXPLANATION, GRANDPARENT_ID, GRANDPARENT_NODE, GROUP, NEIGHBORHOOD, PARENT_ID, PARENT_NODE, PLAIN_ENGLISH_NAME_FOR_PROBLEMCODE, PRJCOMPLETEDATE, PROBADDRESS, PROBADDTYPE, PROBLEMCODE, PROBLEMSID, PROBZIP, PUBLICRESOLUTION, REQUESTID, SRX, SRY, STATUS, SUBMITTO, WARD`.
- `SRX`/`SRY` are **Web Mercator meters (EPSG:3857)**, not state plane. Example: `-10044192.98, 4681102.83` gives lat 38.7162, lon -90.2285. A handful of rows have junk (0, 39, -90, sign-flipped), so filter to the city bounding box after converting.
- Dates look like `2026-01-01 01:28:07.32`.
- Problem codes we use (2026 counts so far): `Potholes - Residnl` 2873, `Debris-alley/street` 2109, `Potholes - Major St` 1696, `Graffiti-Private` 806, `Illegal dumpg report` 772, `Graffiti-Public` 635, `Potholes - Alley` 417, `Debris-Vacant Lot` 345, `Debris-Vacant Bldg` 272, `TDebris-alley/street` 194, `Truck dropped litter` 155, `Traffic Graffiti` 141, `Graffiti-Prvt Dmpstr` 120.
- `Illegal dumpg report`: 893 (2023), 875 (2024), 855 (2025), 772 (2026 to date).
- Report hours peak 8am–4pm (business hours), confirming the "reports, not dumping times" rule above.

## File map

| File | Owner | Responsibility |
|---|---|---|
| `data/scripts/fetch_311.py` (new) | Arjun | Download CSB zip, keep 3 issue types for 2024–2026, convert coords, write `street_reports.json` |
| `data/scripts/build_hotspots.py` (new) | Arjun | Group reports into ~155 m cells, score, write `hotspots.json`, `hotspots_lite.json`, `hotspots_summary.json` |
| `.gitignore` (modify) | Arjun | Ignore `data/raw/` (the 128 MB zip cache) |
| `app/src/lib/hotspots.ts` (from PR #22) | Vedant, then Prahlad | Shared `Hotspot` type + map helpers; Task 3 adds the plan fields |
| `app/src/lib/hotspot-store.ts` (new) | Prahlad | Server-only loader: `getHotspot(id)` |
| `app/src/lib/plan.ts` (new) | Prahlad | Pure `planFacts()` that builds the LLM fact sheet (testable without server-only) |
| `app/src/lib/plan.test.mjs` (new) | Prahlad | node:test for `planFacts()` |
| `app/src/app/api/plan/route.ts` (new) | Prahlad | POST `{id, detections}` returns a camera/cleanup plan |
| `app/scripts/fetch-building-photos.mjs` (modify) | Prahlad | `--source hotspots` to fetch photos at top hotspots |
| Map + side panel (PR #22, contains #20 and #21) | Vedant | Hotspot layer, filters, hotspot panel (built; Task 6 lists the fixes) |
| Crew view | Sarthak | "Today's hotspots" list |
| `docs/demo-script.md` (PR #15) | Sarthak | 2-minute video script for dumping |

---

### Task 0: Clean up the open PRs (Prahlad, 15 min, no code)

- [ ] **Step 1: Merge the PRs that carry over unchanged:** #11 (Gemini fallback list), #12 (README tech), #14 (curb/sidewalk categories), #16 (featured boxes), #18 (tracker overlay), #19 (/watch).
- [ ] **Step 2: Close #20 and #21 without merging.** Their commits are already inside #22 (#22 stacks #20 → #21 → hotspot map). Merge #22 after the Task 6 fixes. #22 carries an identical copy of the #18 overlay file, so merging #18 first is conflict-free.
- [ ] **Step 3: Park the firefighter-only PRs:** #13 (vacancy months), #17 (brief facts). Close #15 or let Sarthak rewrite it in Task 8.
- [ ] **Step 4:** `git pull` on `main` and run `cd app && npm run typecheck && npm run lint && npm run build`. Expected: all pass.

---

### Task 1: `fetch_311.py`, 311 reports to `street_reports.json` (Arjun)

**Files:**
- Create: `data/scripts/fetch_311.py`
- Modify: `.gitignore` (add `data/raw/`)

**Interfaces:**
- Produces: `app/data/clean/street_reports.json`, a list of objects:
  `{id: str, type: "dumping"|"pothole"|"graffiti", code: str, lat: float, lon: float, opened: "YYYY-MM-DD HH:MM", weekday: "Mon".."Sun", hour: int, address: str, neighborhood: int|null, ward: int|null, status: str, days_to_close: float|null}`

- [ ] **Step 1: Add `data/raw/` to `.gitignore`**

```
data/raw/
```

- [ ] **Step 2: Write the script with its self-check**

```python
"""Download the city's 311 (Citizens' Service Bureau) requests and keep illegal dumping,
potholes and graffiti for the last three years.

Source: https://www.stlouis-mo.gov/data/datasets/distribution.cfm?id=2
(one CSV per year inside csb.zip, ~128 MB, cached in data/raw/).

Privacy: we keep the location, type and timing of each report only. We never save
DESCRIPTION, CALLERTYPE or any other free-text or caller field.

Run from the repo root:
    python data/scripts/fetch_311.py

Writes app/data/clean/street_reports.json
"""

import json
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

CSB_URL = "https://www.stlouis-mo.gov/data/upload/data-files/csb.zip"
YEARS = ["2024", "2025", "2026"]
CODES = {
    "Illegal dumpg report": "dumping",
    "Debris-alley/street": "dumping",
    "TDebris-alley/street": "dumping",
    "Debris-Vacant Lot": "dumping",
    "Debris-Vacant Bldg": "dumping",
    "Truck dropped litter": "dumping",
    "Potholes - Residnl": "pothole",
    "Potholes - Major St": "pothole",
    "Potholes - Alley": "pothole",
    "Graffiti-Private": "graffiti",
    "Graffiti-Public": "graffiti",
    "Traffic Graffiti": "graffiti",
    "Graffiti-Prvt Dmpstr": "graffiti",
}
KEEP = ["REQUESTID", "PROBLEMCODE", "DATETIMEINIT", "DATETIMECLOSED", "STATUS",
        "PROBADDRESS", "NEIGHBORHOOD", "WARD", "SRX", "SRY"]
LAT_MIN, LAT_MAX, LON_MIN, LON_MAX = 38.53, 38.78, -90.33, -90.16  # City of St. Louis
EARTH_R = 6378137.0  # Web Mercator sphere radius, meters

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "csb.zip"
OUT = ROOT / "app" / "data" / "clean" / "street_reports.json"


def mercator_to_latlon(x, y):
    """SRX/SRY are Web Mercator meters (EPSG:3857). Works on scalars and numpy arrays."""
    lon = np.degrees(np.asarray(x, dtype=float) / EARTH_R)
    lat = np.degrees(2 * np.arctan(np.exp(np.asarray(y, dtype=float) / EARTH_R)) - np.pi / 2)
    return lat, lon


def self_check():
    lat, lon = mercator_to_latlon(-10044192.98571190, 4681102.83016494)  # a real 2026 row, 8417 Lowell St
    assert abs(lat - 38.7162) < 1e-3 and abs(lon - -90.2285) < 1e-3, (lat, lon)


def load_zip() -> zipfile.ZipFile:
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {CSB_URL} (~128 MB)...")
        urllib.request.urlretrieve(CSB_URL, RAW)
    return zipfile.ZipFile(RAW)


def main():
    self_check()
    z = load_zip()
    frames = [
        pd.read_csv(z.open(f"{y}.csv"), dtype=str, usecols=KEEP, encoding_errors="replace")
        for y in YEARS
    ]
    df = pd.concat(frames, ignore_index=True)
    df["code"] = df["PROBLEMCODE"].str.strip()
    df["type"] = df["code"].map(CODES)
    df = df[df["type"].notna()].copy()

    lat, lon = mercator_to_latlon(pd.to_numeric(df["SRX"], errors="coerce"), pd.to_numeric(df["SRY"], errors="coerce"))
    df["lat"], df["lon"] = lat.round(5), lon.round(5)
    in_city = df["lat"].between(LAT_MIN, LAT_MAX) & df["lon"].between(LON_MIN, LON_MAX)
    print(f"dropped {int((~in_city).sum())} rows with missing or out-of-city coordinates")
    df = df[in_city].copy()

    opened = pd.to_datetime(df["DATETIMEINIT"], errors="coerce")
    closed = pd.to_datetime(df["DATETIMECLOSED"], errors="coerce")
    df = df[opened.notna()].copy()
    opened = opened[opened.notna()]
    closed = closed.loc[df.index]

    out = pd.DataFrame({
        "id": df["REQUESTID"].str.strip(),
        "type": df["type"],
        "code": df["code"],
        "lat": df["lat"],
        "lon": df["lon"],
        "opened": opened.dt.strftime("%Y-%m-%d %H:%M"),
        "weekday": opened.dt.strftime("%a"),
        "hour": opened.dt.hour,
        "address": df["PROBADDRESS"].fillna("").str.strip(),
        "neighborhood": pd.to_numeric(df["NEIGHBORHOOD"], errors="coerce").astype("Int64"),
        "ward": pd.to_numeric(df["WARD"], errors="coerce").astype("Int64"),
        "status": df["STATUS"].fillna("").str.strip(),
        "days_to_close": ((closed - opened).dt.total_seconds() / 86400).round(1),
    })
    out = out.drop_duplicates("id")
    records = json.loads(out.to_json(orient="records"))  # NaN/NA -> null
    OUT.write_text(json.dumps(records, separators=(",", ":")))
    print(f"wrote {len(records)} reports to {OUT}")
    print(out.groupby("type").size().to_string())


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it**

Run: `python data/scripts/fetch_311.py`
Expected: "dropped N rows…" with N under 50, "wrote ~45000 reports", and per-type counts where dumping, pothole and graffiti are each in the thousands. The self-check passes silently.

- [ ] **Step 4: Spot-check one row on a map.** Pick any `Illegal dumpg report` row, paste `lat,lon` into Google Maps, and check it lands on the printed `address`.

- [ ] **Step 5: Commit**

```bash
git checkout -b arjun/street-reports
git add .gitignore data/scripts/fetch_311.py app/data/clean/street_reports.json
git commit -m "feat: 311 dumping, pothole and graffiti reports 2024-2026"
git push -u origin arjun/street-reports
```
If `street_reports.json` is over ~20 MB, commit the script only, open the PR, and tell Prahlad. We then split the output or round more.

---

### Task 2: `build_hotspots.py`, reports to scored hotspots (Arjun)

**Files:**
- Create: `data/scripts/build_hotspots.py`

**Interfaces:**
- Consumes: `app/data/clean/street_reports.json` (Task 1), `app/data/clean/vacant_buildings_lite.json` (rows are `[handle, lat, lon, risk_score, ward]`).
- Produces (the field names match the `Hotspot` type Vedant already ships in PR #22, `app/src/lib/hotspots.ts`; keep them exactly):
  - `app/data/clean/hotspots.json`, a list sorted by score, each item:
    - Vedant's fields: `{id: str, category: "dumping"|"pothole"|"graffiti", lat, lon, ward: int|null, score: int 0-100, report_count: int (all years), trend: float (last 12 months vs the 12 before, 0.25 = +25%), peak_day: "Sun".."Sat", peak_hour: int 0-23, by_dow: int[7] (Sun first), by_hour: int[24], monthly: [{month: "YYYY-MM", count}] (last 24 months)}`
    - Plus plan fields: `{rank: int (within category), reports_12m: int, reports_prev_12m: int, active_weeks_12m: int, report_window: str, median_days_to_close: float|null, top_address: str, vacant_within_150m: int, nearest_vacant_m: int|null, recent: [{opened, code, address}] (last 10), reasons: [str]}`
  - `app/data/clean/hotspots_lite.json`, rows `[id, category, lat, lon, score, reports_12m]` (browser map)
  - `app/data/clean/hotspots_summary.json`: `{generated, window_end, counts: {type: n}, top: {type: [id...10]}}`

- [ ] **Step 1: Write the script with its self-check**

```python
"""Group 311 reports into ~155 m cells and score each cell as a hotspot.

The score only orders hotspots for a person to look at first. It is not a crime
prediction. Report times are when residents reported, not when dumping happened.

Run from the repo root (after fetch_311.py):
    python data/scripts/build_hotspots.py
"""

import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
CLEAN = ROOT / "app" / "data" / "clean"
CELL_LAT, CELL_LON = 0.0014, 0.0018  # ~156 m x ~157 m at St. Louis latitude
MIN_REPORTS = 5  # a cell needs at least this many reports (all years) to count as a hotspot
DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]  # Sun first, same as DAYS in app/src/lib/hotspots.ts


def peak_window(hours: list[int]) -> str:
    """Busiest 3-hour block of report times, e.g. '2pm-5pm'."""
    counts = np.bincount(np.asarray(hours, dtype=int), minlength=24)
    sums = [counts[h] + counts[(h + 1) % 24] + counts[(h + 2) % 24] for h in range(24)]
    start = int(np.argmax(sums))
    fmt = lambda h: f"{(h % 12) or 12}{'am' if h % 24 < 12 else 'pm'}"
    return f"{fmt(start)}-{fmt(start + 3)}"


def meters(lat1, lon1, lat2, lon2):
    rad = np.pi / 180
    a = np.sin((lat2 - lat1) * rad / 2) ** 2 + np.cos(lat1 * rad) * np.cos(lat2 * rad) * np.sin((lon2 - lon1) * rad / 2) ** 2
    return 2 * 6371000 * np.arcsin(np.sqrt(a))


def self_check():
    assert peak_window([14, 14, 15, 16, 9]) == "2pm-5pm", peak_window([14, 14, 15, 16, 9])
    assert peak_window([23, 0, 1]) == "11pm-2am", peak_window([23, 0, 1])
    assert abs(meters(38.627, -90.199, 38.628, -90.199) - 111) < 1


def main():
    self_check()
    r = pd.read_json(CLEAN / "street_reports.json")
    r["opened"] = pd.to_datetime(r["opened"])
    end = r["opened"].max()
    r["in_12m"] = r["opened"] > end - pd.Timedelta(days=365)
    r["in_prev_12m"] = (r["opened"] <= end - pd.Timedelta(days=365)) & (r["opened"] > end - pd.Timedelta(days=730))
    r["week"] = r["opened"].dt.to_period("W").astype(str)
    r["month"] = r["opened"].dt.strftime("%Y-%m")
    months = pd.period_range(end=end.to_period("M"), periods=24, freq="M").strftime("%Y-%m").tolist()
    r["cell"] = (r["lat"] // CELL_LAT).astype(int).astype(str) + "_" + (r["lon"] // CELL_LON).astype(int).astype(str)

    vac = np.array(json.loads((CLEAN / "vacant_buildings_lite.json").read_text()), dtype=object)
    vlat, vlon = vac[:, 1].astype(float), vac[:, 2].astype(float)

    rows = []
    for (kind, cell), g in r.groupby(["type", "cell"]):
        if len(g) < MIN_REPORTS:
            continue
        lat, lon = round(g["lat"].mean(), 5), round(g["lon"].mean(), 5)
        d = meters(lat, lon, vlat, vlon)
        recent = g.sort_values("opened", ascending=False).head(10)
        by_dow = g["weekday"].value_counts().reindex(DAYS, fill_value=0).astype(int).tolist()
        by_hour = np.bincount(g["hour"].astype(int), minlength=24).tolist()
        per_month = g["month"].value_counts()
        r12, prev = int(g["in_12m"].sum()), int(g["in_prev_12m"].sum())
        rows.append({
            "id": f"{kind}-{cell}",
            "category": kind,
            "lat": lat,
            "lon": lon,
            "ward": None if g["ward"].isna().all() else int(g["ward"].mode().iat[0]),
            "report_count": len(g),
            "trend": round((r12 - prev) / max(prev, 1), 2),
            "peak_day": DAYS[int(np.argmax(by_dow))],
            "peak_hour": int(np.argmax(by_hour)),
            "by_dow": by_dow,
            "by_hour": by_hour,
            "monthly": [{"month": m, "count": int(per_month.get(m, 0))} for m in months],
            "reports_12m": r12,
            "reports_prev_12m": prev,
            "active_weeks_12m": int(g.loc[g["in_12m"], "week"].nunique()),
            "report_window": peak_window(g["hour"].tolist()),
            "median_days_to_close": None if g["days_to_close"].isna().all() else round(float(g["days_to_close"].median()), 1),
            "top_address": g["address"].mode().iat[0] if g["address"].str.len().gt(0).any() else "",
            "vacant_within_150m": int((d <= 150).sum()),
            "nearest_vacant_m": int(d.min()) if len(d) else None,
            "recent": [
                {"opened": o.strftime("%Y-%m-%d"), "code": c, "address": a}
                for o, c, a in zip(recent["opened"], recent["code"], recent["address"])
            ],
        })
    h = pd.DataFrame(rows)

    # Score within each category, so potholes don't drown out dumping.
    volume = h.groupby("category")["reports_12m"].rank(pct=True)
    repeat = (h["active_weeks_12m"] / 52).clip(upper=1)
    trend = h["trend"].clip(-1, 1)
    vacant = (h["vacant_within_150m"] / 3).clip(upper=1)
    h["score"] = (100 * (0.4 * volume + 0.3 * repeat + 0.15 * (trend + 1) / 2 + 0.15 * vacant)).round().astype(int)
    h = h.sort_values(["score", "reports_12m"], ascending=False)
    h["rank"] = h.groupby("category").cumcount() + 1

    def reasons(x) -> list[str]:
        out = [f"{x.reports_12m} reports in the last 12 months"]
        if x.active_weeks_12m >= 4:
            out.append(f"reported in {x.active_weeks_12m} different weeks this year")
        if x.reports_prev_12m and x.reports_12m > 1.2 * x.reports_prev_12m:
            out.append(f"up from {x.reports_prev_12m} the year before")
        if x.vacant_within_150m:
            out.append(f"{x.vacant_within_150m} vacant buildings within 150 m")
        out.append(f"most reports on {x.peak_day}, mostly reported {x.report_window}")
        return out

    h["reasons"] = [reasons(x) for x in h.itertuples()]
    assert h["score"].between(0, 100).all()
    assert not h.duplicated(["category", "rank"]).any()
    assert all(len(d) == 7 for d in h["by_dow"]) and all(len(x) == 24 for x in h["by_hour"])

    records = json.loads(h.to_json(orient="records"))
    (CLEAN / "hotspots.json").write_text(json.dumps(records, separators=(",", ":")))
    lite = h[["id", "category", "lat", "lon", "score", "reports_12m"]].values.tolist()
    (CLEAN / "hotspots_lite.json").write_text(json.dumps(lite, separators=(",", ":")))
    summary = {
        "generated": date.today().isoformat(),
        "window_end": end.strftime("%Y-%m-%d"),
        "counts": h.groupby("category").size().to_dict(),
        "top": {k: g.head(10)["id"].tolist() for k, g in h.groupby("category")},
    }
    (CLEAN / "hotspots_summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary["counts"]), "hotspots")
    print(h.head(5)[["id", "score", "reports_12m", "top_address"]].to_string(index=False))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python data/scripts/build_hotspots.py`
Expected: hotspot counts per type (dumping roughly in the hundreds) and a top-5 table with real addresses. Self-check passes silently.

- [ ] **Step 3: Sanity-check the top 3 dumping hotspots.** Open each `lat,lon` in Google Maps Street View. Is it an alley, a vacant lot or a dead-end street? Note any that look wrong in the PR.

- [ ] **Step 4: Commit**

```bash
git add data/scripts/build_hotspots.py app/data/clean/hotspots.json app/data/clean/hotspots_lite.json app/data/clean/hotspots_summary.json
git commit -m "feat: scored 311 hotspots for dumping, potholes and graffiti"
git push
```
Open a PR from `arjun/street-reports` and tell Vedant the lite format is live.

---

### Task 3: Hotspot loader + `planFacts()` with a test (Prahlad)

**Files** (build on top of PR #22, which already adds `app/src/lib/hotspots.ts`. Merge #22 first or branch from it):
- Modify: `app/src/lib/hotspots.ts` (add the plan fields to Vedant's `Hotspot` type)
- Create: `app/src/lib/hotspot-store.ts` (server-only loader)
- Create: `app/src/lib/plan.ts`
- Test: `app/src/lib/plan.test.mjs`

**Interfaces:**
- Consumes: `hotspots.json` (Task 2 shape); Vedant's `Hotspot`, `HotspotCategory`, `DAYS` from `@/lib/hotspots`.
- Produces:
  - `type Hotspot` gains the plan fields; `getHotspot(id: string): Hotspot | undefined` in `hotspot-store.ts` (server-only)
  - `planFacts(h: Hotspot, detections: PlanDetection[]): Record<string, unknown>` in `plan.ts` (only a type import, so node:test can load it)

- [ ] **Step 1: Write the failing test** `app/src/lib/plan.test.mjs`

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planFacts } from './plan.ts';

const h = {
  id: 'dumping-27593_-50111', category: 'dumping', lat: 38.6612, lon: -90.2011, ward: 14, score: 91, rank: 1,
  report_count: 40, trend: 1.44, peak_day: 'Mon', peak_hour: 14,
  by_dow: [2, 12, 6, 5, 6, 5, 4], by_hour: Array(24).fill(0), monthly: [],
  reports_12m: 22, reports_prev_12m: 9, active_weeks_12m: 15,
  report_window: '2pm-5pm', median_days_to_close: 6.5,
  top_address: '2700 N GRAND BLVD', vacant_within_150m: 4, nearest_vacant_m: 35,
  recent: [{ opened: '2026-10-01', code: 'Illegal dumpg report', address: '2700 N GRAND BLVD' }],
  reasons: ['22 reports in the last 12 months'],
};

test('planFacts labels report times as report times, not dumping times', () => {
  const f = planFacts(h, []);
  assert.equal(f.reports_mostly_come_in, '2pm-5pm');
  assert.equal(f.most_reports_on, 'Mon');
  assert.ok(!('dumping_time' in f));
});

test('planFacts passes photo findings through and states the rank', () => {
  const f = planFacts(h, [{ category: 'dumping', severity: 'high', note: 'mattresses and tires' }]);
  assert.deepEqual(f.photo_findings, [{ category: 'dumping', severity: 'high', note: 'mattresses and tires' }]);
  assert.equal(f.priority, '91/100 (#1 of dumping hotspots)');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd app && node --test src/lib/plan.test.mjs`
Expected: FAIL, cannot find module `./plan.ts`.

- [ ] **Step 3: Write `app/src/lib/plan.ts`**

```ts
import type { Hotspot } from "@/lib/hotspots";

// Builds the fact sheet the LLM sees for one hotspot. Type-only import, so node:test can load this file.
export type PlanDetection = { category: string; severity: "low" | "medium" | "high"; note: string };

export function planFacts(h: Hotspot, detections: PlanDetection[]): Record<string, unknown> {
  return {
    issue_type: h.category,
    near_address: h.top_address,
    priority: `${h.score}/100 (#${h.rank} of ${h.category} hotspots)`,
    reports_last_12_months: h.reports_12m,
    reports_year_before: h.reports_prev_12m,
    weeks_with_reports_this_year: h.active_weeks_12m,
    most_reports_on: h.peak_day,
    reports_mostly_come_in: h.report_window,
    median_days_to_close: h.median_days_to_close,
    vacant_buildings_within_150m: h.vacant_within_150m,
    latest_reports: h.recent.slice(0, 5),
    photo_findings: detections,
  };
}
```

- [ ] **Step 4: Add the plan fields to Vedant's `Hotspot` type** in `app/src/lib/hotspots.ts`. Insert after `monthly: …;` and drop his "shape guessed" ponytail comment:

```ts
  // From data/scripts/build_hotspots.py, used by the panel and /api/plan.
  rank: number; // within its category
  reports_12m: number;
  reports_prev_12m: number;
  active_weeks_12m: number;
  report_window: string; // busiest 3-hour block of REPORT times, e.g. "2pm-5pm"
  median_days_to_close: number | null;
  top_address: string;
  vacant_within_150m: number;
  nearest_vacant_m: number | null;
  recent: { opened: string; code: string; address: string }[];
  reasons: string[];
```

Then write `app/src/lib/hotspot-store.ts`:

```ts
import "server-only";

import data from "../../data/clean/hotspots.json";
import type { Hotspot } from "@/lib/hotspots";

// Server-side lookup for /api/plan. The browser gets hotspots via the page, never this file.
const byId = new Map((data as unknown as Hotspot[]).map((h) => [h.id, h]));

export function getHotspot(id: string): Hotspot | undefined {
  return byId.get(id);
}
```

- [ ] **Step 5: Run the test and typecheck**

Run: `cd app && node --test src/lib/plan.test.mjs && npm run typecheck`
Expected: 2 tests pass, typecheck clean. Vedant's sample file (`app/data/sample/hotspots.sample.json`) lacks the plan fields. That's fine: `page.tsx` only uses it until the real file exists.

- [ ] **Step 6: Commit** (needs Task 2's `hotspots.json` on the branch: rebase on Arjun's branch or merge his PR first)

```bash
git checkout -b prahlad/hotspot-lib
git add app/src/lib/plan.ts app/src/lib/plan.test.mjs app/src/lib/hotspots.ts app/src/lib/hotspot-store.ts
git commit -m "feat: hotspot loader and plan fact sheet"
```

---

### Task 4: `/api/plan` route (Prahlad)

**Files:**
- Create: `app/src/app/api/plan/route.ts`

**Interfaces:**
- Consumes: `getHotspot` (Task 3), `planFacts` (Task 3), `chatJSON` from `@/lib/llm`, `CATEGORIES` from `@/lib/issues`.
- Produces: `POST /api/plan` with body `{id: string, detections?: {category, severity, note}[]}`. Returns `200 {id, headline, what_we_know: string[], watch: string[], actions: string[], evidence: string[]}`, `400` on a bad body, `404` on an unknown id, `502` on an LLM failure.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getHotspot } from "@/lib/hotspot-store";
import { CATEGORIES } from "@/lib/issues";
import { chatJSON } from "@/lib/llm";
import { planFacts } from "@/lib/plan";

const requestSchema = z.object({
  id: z.string().regex(/^(dumping|pothole|graffiti)-\d+_-?\d+$/),
  // What the vision model saw on the nearest street photo, if any.
  detections: z
    .array(z.object({ category: z.enum(CATEGORIES), severity: z.enum(["low", "medium", "high"]), note: z.string().max(200) }))
    .max(30)
    .default([]),
});

const planSchema = z.object({
  headline: z.string(),
  what_we_know: z.array(z.string()).max(5),
  watch: z.array(z.string()).max(3),
  actions: z.array(z.string()).max(5),
  evidence: z.array(z.string()).max(5),
});

const SYSTEM = `You write short action plans for St. Louis city staff about one repeat hotspot of illegal dumping, potholes or graffiti.
Use ONLY the facts given. Never invent dates, counts, people, vehicles or causes.
Never try to identify a person. No faces, no license plates, no names. Plans target places and times, not people.
Report times are when residents REPORTED the problem, not when it happened: say "reports mostly come in ...", never "dumping happens at ...".
Phrase facts as "311 reports show" or "photo shows". Plain words, no jargon. Return JSON only:
{"headline":"one line, under 15 words",
 "what_we_know":["up to 5 sourced facts"],
 "watch":["up to 3: where and on which days to point a camera or schedule a drive-by"],
 "actions":["up to 5 practical steps: cleanup crew, signage, lighting, camera, notify owner of a vacant lot"],
 "evidence":["up to 5: what this site's report history and photos can support if the city pursues a citation"]}`;

// One hotspot + latest photo findings in, a short camera/cleanup plan out.
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const hotspot = getHotspot(parsed.data.id);
  if (!hotspot) {
    return NextResponse.json({ error: "unknown hotspot id" }, { status: 404 });
  }

  try {
    const plan = await chatJSON(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(planFacts(hotspot, parsed.data.detections)) },
      ],
      planSchema,
    );
    return NextResponse.json({ id: hotspot.id, ...plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `cd app && npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 3: Real call against the dev server.** Take the top dumping id from `hotspots_summary.json`.

```bash
cd app && npm run dev &
ID=$(node -e "console.log(require('./data/clean/hotspots_summary.json').top.dumping[0])")
curl -s localhost:3000/api/plan -H 'content-type: application/json' -d "{\"id\":\"$ID\"}" | head -c 1500
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/plan -H 'content-type: application/json' -d '{"id":"dumping-1_1"}'
```
Expected: the first call returns JSON with `headline`, `watch` and `actions`, and no claims about who dumps. The second prints `404`.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/plan/route.ts
git commit -m "feat: /api/plan writes a camera and cleanup plan for a hotspot"
git push -u origin prahlad/hotspot-lib
```

---

### Task 5: Street photos at top hotspots (Prahlad)

**Files:**
- Modify: `app/scripts/fetch-building-photos.mjs`

**Interfaces:**
- Consumes: `hotspots.json` (Task 2). `MAPILLARY_TOKEN` comes from `~/.config/summithack/keys.env` (Aarnav's token; the user's own token returns no photos).
- Produces: entries in `app/public/photos/index.json` with `hotspot_id` instead of a building handle, same `after.detections` box format (0–1 x/y/w/h).

- [ ] **Step 1:** Add a `source` option (`'buildings'` default, `'hotspots'`). When it's `hotspots`, load `data/clean/hotspots.json`, keep the top `--top` items of `category === 'dumping'` first and then the rest by score. Aim at `{lat, lon}` the same way as for buildings, and write `hotspot_id: h.id` on the index entry.
- [ ] **Step 2:** Run `MAPILLARY_TOKEN=… node scripts/fetch-building-photos.mjs --source hotspots --top 300 --max 20 --detect http://localhost:3000 --precise 1`. Use `--precise 1` (Gemini), never Groq near recording, because the Groq daily cap is ~95 photos.
- [ ] **Step 3:** Open 5 saved photos and check the dumping boxes sit on actual debris. Expect low coverage: Mapillary photos are mostly from main roads, and dumping is often in alleys. Pick the 3–4 hotspots that have good photos as the **featured** demo hotspots and record their ids in the PR description.
- [ ] **Step 4:** Commit `feat: street photos at top dumping hotspots`.

---

### Task 6: Fixes to the hotspot map + panel (Vedant, PR #22)

PR #22 already has the map, category/ward/day/time filters, the vacant-buildings toggle, the panel with a monthly timeline and nearest photo, and friendly 429/503 errors. Review on 2026-10-14: typecheck, lint, 14 tests and build all pass. These fixes remain:

**Interfaces:**
- Consumes: `hotspots.json` (Task 2 shape, Vedant's field names plus plan fields); `POST /api/plan` (Task 4) with body `{id, detections}`, returning `{id, headline, what_we_know[], watch[], actions[], evidence[]}`; `app/public/photos/index.json` entries with `hotspot_id` (Task 5).

- [ ] **Step 1 (bug, confirmed in browser):** "Write plan" POSTs `{hotspot_id}` to `/api/brief`, which wants an 11-digit building `handle`, so it always fails with "Invalid input: expected string, received undefined → at handle". Change it to `fetch("/api/plan", … body: JSON.stringify({ id: h.id, detections }))` and render `headline`, `what_we_know`, `watch`, `actions` and `evidence` (drop the guessed `hazards`/`crew_notes`).
- [ ] **Step 2 (wording rule):** Rename the "Peak hour" stat to "Most reports at" and the "Time" filter label to "Reported", or replace the stat with `report_window` ("Reports mostly come in 2pm-5pm"). Report times are not dumping times.
- [ ] **Step 3 (payload):** `page.tsx` passes every full hotspot (by_hour, monthly, recent, reasons) and all 9,884 vacant rows into the client component, so it all goes into the page HTML. That's 495 KB today with sample data; real data adds about 1 KB per hotspot. If the built `index.html` goes over ~1.5 MB, strip the client list to `{id, category, lat, lon, ward, score, report_count, by_dow, by_hour}` and fetch the full record from a tiny `GET /api/hotspots/[id]` (copy `api/buildings/[handle]/route.ts`, use `getHotspot` from `@/lib/hotspot-store`).
- [ ] **Step 4:** Show `top_address`, `rank` and `reasons` in the panel header once the real file lands, plus the last 10 `recent` reports.
- [ ] **Step 5:** Prefer the photo whose `hotspot_id` matches (Task 5) and fall back to the nearest within 300 m. Label a fallback photo "nearest street photo, X m away" (already done) so viewers don't assume it's the exact spot.
- [ ] **Step 6:** Update copy in `layout.tsx`: the description still says "Ranks St. Louis vacant buildings by danger…". Change it to the dumping pitch.
- [ ] **Step 7:** `npm run typecheck && npm run lint && npm run build` pass. Push to #22.

---

### Task 7: Crew view, "Today's hotspots" (Sarthak)

- [ ] **Step 1:** List the top 10 hotspots from `hotspots_lite.json` for the chosen category (default dumping), sorted by score. Each row shows the address (from a server-side join with `hotspots.json`), score, "most reports on {peak_day}", and an "Open plan" link to the map panel for that id.
- [ ] **Step 2:** Mobile-first layout (crews use phones). Reuse shadcn `Card`, `Badge` and `Button`.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm run build` pass. Push.

---

### Task 8: Story, video and submission (Sarthak lead, everyone)

- [ ] **Step 1: Rewrite `docs/demo-script.md` (2 minutes):**
  1. A dumping photo with boxes drawing on.
  2. "St. Louis doubled the dumping fine to $1,000 in 2022, but it still can't catch most offenders."
  3. The hotspot map: "~2,500 illegal-dumping reports since Jan 2024, plus thousands of debris reports". Use the real number from `hotspots_summary.json` / `street_reports.json`.
  4. One featured hotspot: reasons, report pattern, photo, and the generated plan.
  5. "We target places and times, never people: no faces, no plates."
  6. Who uses it: Refuse Division crews, the Citizens' Service Bureau, neighborhood improvement specialists.
  7. Limits: report times aren't dumping times, and photo coverage is thin in alleys.
- [ ] **Step 2:** Everyone writes their one-line "why this matters" in their own words in the README.
- [ ] **Step 3: Record** Thursday by noon using `DEMO_CACHE=1` so LLM replies replay reliably.
- [ ] **Step 4: Submit by 3:30pm CT** (Aarnav). Upload the video to YouTube as **unlisted or public** (not private) and post the link in the organizer doc. Upload the project folder to the hackathon Dropbox (link in the organizer doc).

---

### Task 9: Final verification (Prahlad)

- [ ] **Step 1:** `cd app && npm run typecheck && npm run lint && npm run build && node --test src/lib/*.test.mjs`. Everything must pass.
- [ ] **Step 2:** Playwright run on `localhost:3000` with real data: open the map, filter to Dumping, click the #1 hotspot, press "Write plan", and confirm a plan appears with no "dumping happens at" wording. Then open the crew view on a phone-sized viewport.
- [ ] **Step 3:** On the Vercel production URL: `/api/health` shows `"vision": {"fast": true, "confirm": true}`, and the page opens without a Vercel login (Deployment Protection off).

## Timeline (CT)

| When | What |
|---|---|
| Wed evening | Task 0; Arjun Tasks 1–2; Prahlad Tasks 3–4 (against fake rows until Task 2 lands) |
| Wed late / Thu 9am | Task 5 photos; Vedant Task 6; Sarthak Task 7 + script |
| Thu 11am | Task 9 verification, featured hotspots locked |
| Thu 12pm | Record |
| Thu 3:30pm | Upload (deadline 4:30pm) |

## Risks

- **Photo coverage:** dumping happens in alleys, and Mapillary rarely covers alleys. The demo uses the 3–4 hotspots with good photos and says the gap out loud.
- **Groq daily cap (~95 photos/day across all our keys):** run detection with `--precise 1` (Gemini) and swap in the new Groq key before recording.
- **Report-hour bias:** handled by the wording rule above. Don't let the LLM or the UI drift from it.
- **Another team also chose #3:** our edge is the AI photo check plus a ready-to-act plan, built on vacant-property data we already have.
