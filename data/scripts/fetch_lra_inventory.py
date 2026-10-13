"""Download the city's LRA property inventory, clean it, and save JSON for the app.

LRA = Land Reutilization Authority, the city agency that holds vacant and
tax-foreclosed property. Source page:
https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=30

Run from the repo root:
    python data/scripts/fetch_lra_inventory.py

It writes two files:
    app/data/clean/lra_inventory.json   one record per parcel, cleaned
    app/data/clean/lra_summary.json     small counts, safe to send to the LLM

Copy this file as the starting point for any new dataset.
"""

import json
from datetime import date
from pathlib import Path

import pandas as pd

SOURCE_URL = "https://static.stlouis-mo.gov/open-data/SLDC/REAL-ESTATE/LRA_INVENTORY.csv"
SOURCE_PAGE = "https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=30"

# Repo root is two folders up from this file (data/scripts/ -> repo root).
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "app" / "data" / "clean"


def download() -> pd.DataFrame:
    # dtype=str keeps parcel IDs like "04839150000" from losing their leading zero.
    return pd.read_csv(SOURCE_URL, dtype=str, keep_default_na=False, encoding="utf-8-sig")


def first_of_pair(value: str) -> str:
    """The city writes some fields twice, e.g. "Vacant Lot,Vacant Lot". Keep one, fix the case."""
    first = value.split(",")[0].strip()
    return first.title() if first else ""


def clean(raw: pd.DataFrame) -> pd.DataFrame:
    df = pd.DataFrame()
    df["parcel_id"] = raw["ParcelId"].str.strip()
    df["status"] = raw["Parcel_Status"].str.strip()
    df["usage"] = raw["Usage"].map(first_of_pair)
    df["property_type"] = raw["PropertyType"].str.strip()
    # Squash runs of spaces: "1239   GRATTAN ST " -> "1239 GRATTAN ST"
    df["address"] = raw["Address"].str.split().str.join(" ")
    df["ward"] = pd.to_numeric(raw["WARD"], errors="coerce").astype("Int64")
    df["neighborhood"] = raw["NeighborhoodName"].str.strip()
    df["source"] = raw["Property_Source"].str.strip().str.title()
    df["side_lot_eligible"] = raw["Side lot Eligible?"].str.strip().str.lower().eq("yes")
    df["sqft"] = pd.to_numeric(raw["SQFT"], errors="coerce").astype("Int64")
    # Dates arrive as "Wed Apr 04 1973 18:00:00 GMT-0600 (Central ...)". Characters 4-15 are "Apr 04 1973".
    acquired = pd.to_datetime(raw["ACQUISITION_DATE"].str.slice(4, 15), format="%b %d %Y", errors="coerce")
    df["acquired"] = acquired.dt.strftime("%Y-%m-%d")

    df = df[df["parcel_id"] != ""]
    df = df.drop_duplicates(subset="parcel_id")
    return df.sort_values("parcel_id").reset_index(drop=True)


def summarize(df: pd.DataFrame) -> dict:
    by_hood = df.groupby("neighborhood").size().sort_values(ascending=False)
    return {
        "source": SOURCE_PAGE,
        "downloaded": date.today().isoformat(),
        "total_parcels": int(len(df)),
        "by_status": {k: int(v) for k, v in df["status"].value_counts().items()},
        "by_usage": {k or "Unknown": int(v) for k, v in df["usage"].value_counts().items()},
        "side_lot_eligible": int(df["side_lot_eligible"].sum()),
        "top_neighborhoods": {k: int(v) for k, v in by_hood.head(10).items()},
    }


def check(df: pd.DataFrame) -> None:
    """Stop with a clear message if the city changed the file in a way that breaks us."""
    assert len(df) > 1000, f"only {len(df)} parcels; the download probably failed"
    assert df["parcel_id"].is_unique, "duplicate parcel IDs after cleaning"
    assert df["parcel_id"].str.len().eq(11).mean() > 0.95, "parcel IDs no longer look like 11 digits"
    assert df["status"].isin(["Available", "Unavailable"]).all(), "new status values appeared"


def main() -> None:
    print(f"Downloading {SOURCE_URL} ...")
    raw = download()
    print(f"  {len(raw)} rows, {len(raw.columns)} columns")

    df = clean(raw)
    check(df)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = df.astype(object).where(df.notna(), None).to_dict(orient="records")
    (OUT_DIR / "lra_inventory.json").write_text(json.dumps(records, indent=1))
    (OUT_DIR / "lra_summary.json").write_text(json.dumps(summarize(df), indent=2))

    print(f"Saved {len(df)} parcels to {OUT_DIR.relative_to(ROOT)}/lra_inventory.json")
    print(f"Saved counts to {OUT_DIR.relative_to(ROOT)}/lra_summary.json")


if __name__ == "__main__":
    main()
