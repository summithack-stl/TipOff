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
