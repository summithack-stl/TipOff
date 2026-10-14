"""Download the city's vacant-buildings list, add locations, and save JSON for the app.

Two city sources, joined on the parcel "handle":
- Building Commissioner vacant-building overview (one row per vacant building parcel,
  with code violations, months vacant, 311 complaints and unpaid fees):
  https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=108
- Assessor public parcels map service (address, ward, neighborhood, year built,
  year it went vacant, and the parcel shape, which we turn into a center point):
  https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=82

Owner names are deliberately NOT saved: the app must not show personal data
about real residents. We only keep a yes/no flag for city (LRA) ownership.

Run from the repo root:
    python data/scripts/fetch_vacant_buildings.py

It writes two files:
    app/data/clean/vacant_buildings.json   one record per vacant building parcel
    app/data/clean/vacant_summary.json     small counts, safe to send to the LLM
"""

import json
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import pandas as pd

OVERVIEW_URL = "https://www.stlcitypermits.com/API/VacantBuilding/GetVacantBuildingOverview"
PARCELS_URL = "https://maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/11/query"
SOURCE_PAGES = [
    "https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=108",
    "https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=82",
]
PARCEL_FIELDS = "Handle,ParcelId,SITEADDR,Ward20,Nbrhd,FirstYearBuilt,VacBldgYear,NbrOfBldgsRes,NbrOfBldgsCom,OwnerName"
BATCH = 200  # handles per map-service request (the service caps replies at 2000 records)

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "app" / "data" / "clean"


def get_json(url: str, retries: int = 3) -> dict:
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "summithack-data/0.1"})
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except Exception as e:  # network hiccup: wait and retry
            if attempt == retries:
                raise
            print(f"  retry {attempt} after error: {e}")
            time.sleep(5 * attempt)
    raise RuntimeError("unreachable")


def download_overview() -> pd.DataFrame:
    # Shape: {"11760000440": {"mo": 109, "vmin": 7, "vmaj": 2, "csb": 0, "unpd": 0.0}, ...}
    raw = get_json(OVERVIEW_URL)
    df = pd.DataFrame.from_dict(raw, orient="index")
    df.index.name = "handle"
    return df.reset_index()


def center(rings: list) -> tuple[float, float]:
    """Average of the outer ring's corners. Good enough to find street photos within 50 m."""
    pts = rings[0]
    lon = sum(p[0] for p in pts) / len(pts)
    lat = sum(p[1] for p in pts) / len(pts)
    return round(lat, 6), round(lon, 6)


def download_parcels(handles: list[str]) -> pd.DataFrame:
    rows = []
    for i in range(0, len(handles), BATCH):
        chunk = handles[i : i + BATCH]
        query = urllib.parse.urlencode({
            "where": "Handle IN (" + ",".join(f"'{h}'" for h in chunk) + ")",
            "outFields": PARCEL_FIELDS,
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "json",
        })
        reply = get_json(f"{PARCELS_URL}?{query}")
        for feature in reply.get("features", []):
            a = feature["attributes"]
            rings = (feature.get("geometry") or {}).get("rings")
            if not rings:
                continue
            lat, lon = center(rings)
            rows.append({**a, "lat": lat, "lon": lon})
        print(f"  parcels {min(i + BATCH, len(handles))}/{len(handles)}")
    return pd.DataFrame(rows)


def clean(overview: pd.DataFrame, parcels: pd.DataFrame) -> pd.DataFrame:
    parcels = parcels.drop_duplicates(subset="Handle")
    df = overview.merge(parcels, left_on="handle", right_on="Handle", how="inner")
    owner = df["OwnerName"].fillna("").str.upper()
    out = pd.DataFrame({
        "handle": df["handle"],
        "parcel_id": df["ParcelId"],
        "address": df["SITEADDR"].fillna("").str.split().str.join(" "),
        "lat": df["lat"],
        "lon": df["lon"],
        "ward": pd.to_numeric(df["Ward20"], errors="coerce").astype("Int64"),
        "neighborhood": pd.to_numeric(df["Nbrhd"], errors="coerce").astype("Int64"),
        "year_built": pd.to_numeric(df["FirstYearBuilt"], errors="coerce").astype("Int64"),
        "vacant_since": pd.to_numeric(df["VacBldgYear"], errors="coerce").astype("Int64"),
        "months_vacant": pd.to_numeric(df["mo"], errors="coerce").fillna(0).astype(int),
        "major_violations": pd.to_numeric(df["vmaj"], errors="coerce").fillna(0).astype(int),
        "minor_violations": pd.to_numeric(df["vmin"], errors="coerce").fillna(0).astype(int),
        "complaints_311": pd.to_numeric(df["csb"], errors="coerce").fillna(0).astype(int),
        "unpaid_fees": pd.to_numeric(df["unpd"], errors="coerce").fillna(0.0).round(2),
        "lra_owned": owner.str.contains("LAND REUTILIZATION|^LRA\\b", regex=True),
    })
    # The year fields use 0 for "unknown".
    for col in ["year_built", "vacant_since"]:
        out.loc[out[col] == 0, col] = pd.NA
    return out.sort_values(["major_violations", "months_vacant"], ascending=False).reset_index(drop=True)


def summarize(df: pd.DataFrame, overview_count: int) -> dict:
    by_ward = df.groupby("ward").size().sort_values(ascending=False)
    return {
        "sources": SOURCE_PAGES,
        "downloaded": date.today().isoformat(),
        "vacant_building_parcels": overview_count,
        "with_location": int(len(df)),
        "lra_owned": int(df["lra_owned"].sum()),
        "with_5plus_major_violations": int((df["major_violations"] >= 5).sum()),
        "median_months_vacant": float(df["months_vacant"].median()),
        "built_before_1920": int((df["year_built"] < 1920).sum()),
        "top_wards": {str(k): int(v) for k, v in by_ward.head(10).items()},
    }


def check(df: pd.DataFrame, overview_count: int) -> None:
    """Stop with a clear message if a source changed in a way that breaks us."""
    assert overview_count > 1000, f"only {overview_count} vacant buildings; the download probably failed"
    assert len(df) > 0.9 * overview_count, f"only {len(df)} of {overview_count} got a location"
    assert df["handle"].is_unique, "duplicate handles after cleaning"
    assert df["lat"].between(38.53, 38.78).all() and df["lon"].between(-90.33, -90.16).all(), "points outside St. Louis"


def main() -> None:
    print(f"Downloading {OVERVIEW_URL} ...")
    overview = download_overview()
    print(f"  {len(overview)} vacant building parcels")

    print("Looking up locations from the Assessor parcel map ...")
    parcels = download_parcels(overview["handle"].tolist())

    df = clean(overview, parcels)
    check(df, len(overview))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = df.astype(object).where(df.notna(), None).to_dict(orient="records")
    (OUT_DIR / "vacant_buildings.json").write_text(json.dumps(records, indent=1))
    (OUT_DIR / "vacant_summary.json").write_text(json.dumps(summarize(df, len(overview)), indent=2))

    print(f"Saved {len(df)} buildings to {OUT_DIR.relative_to(ROOT)}/vacant_buildings.json")
    print(f"Saved counts to {OUT_DIR.relative_to(ROOT)}/vacant_summary.json")


if __name__ == "__main__":
    main()
