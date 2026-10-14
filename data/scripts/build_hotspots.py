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
