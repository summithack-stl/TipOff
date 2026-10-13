# St. Louis open data brief

Every URL below was opened in a real browser on 2026-10-12 and showed the dataset page. Format and update frequency come from each page's own listing. "Auth" is what you need before you can pull the data. Anything we couldn't confirm is marked **unverified**.

City portal home: https://www.stlouis-mo.gov/data/ (all datasets: https://www.stlouis-mo.gov/data/datasets/index.cfm)

| # | Dataset | URL | Format | Updated | Auth | One idea it enables |
|---|---|---|---|---|---|---|
| 1 | CSB Service Requests (311) | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=5 | CSV (weekly) + Open311 API (real-time) | Weekly / real-time | None | Read free-text 311 requests and route or deduplicate them, or flag streets with repeat complaints |
| 2 | Vacant Buildings | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=108 | API (slow: full list can take ~5 min) | Live | None | Rank vacant buildings for stabilisation by joining 311 complaints and inspections |
| 3 | LRA Property (Land Reutilization Authority) | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=30 | CSV (inventory, bid decisions, garden permits) | Nightly | None | Help residents find LRA lots for side-lot or garden programs and explain the steps in plain language |
| 4 | Crime Data (SLMPD) | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=69 | Website (monthly reports), CSV (hate crimes) | Monthly | None | Neighborhood safety summaries in plain English. Hard to scrape, so scope carefully |
| 5 | Building Permits | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=1 | Website (by neighborhood / type / ward) | Real-time | None | Show where investment is happening next to vacancy; explain permits to first-time builders |
| 6 | Building Inspections – Existing Structures | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=11 | API / JSON (90-day window per query) | Live | None | Summarise a parcel's inspection history for a buyer or tenant |
| 7 | Housing Conservation Inspections | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=113 | API | Live | None | Rental-safety lookup: has this unit passed inspection recently? |
| 8 | Forestry Property Maintenance, Grass Cuts | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=64 | CSV (service records, monthly) + ESRI MapServer | Monthly | None | Plan mowing and debris routes for vacant lots; spot missed cuts |
| 9 | City Parks | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=46 | Shapefile | Last updated 5/30/2013 (old) | None | Park access gaps by neighborhood (check boundaries are still current) |
| 10 | Neighborhood Boundaries | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=85 | Shapefile | Last updated 2/21/2023 | None | The join key for almost every other dataset: roll anything up by neighborhood |
| 11 | Parcel Data (Assessor) | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=82 | Shapefile (historic years) | Last updated 1/22/2022 | None | Parcel geometry for maps; join on Parcel ID / Handle |
| 12 | Metro St. Louis GTFS (transit) | https://www.metrostlouis.org/developer-resources/ | GTFS zip download | Not stated | Accept Metro's terms of use | Transit access to clinics, jobs or cooling centers |
| 13 | Census ACS 5-Year | https://www.census.gov/data/developers/data-sets/acs-5year.html | JSON API | Yearly (2009–2024 on page) | Free API key (check the page for limits) | Income, rent burden and car ownership by tract to target who needs help |
| 14 | Eviction Lab – St. Louis tracking | https://evictionlab.org/eviction-tracking/st-louis-mo/ | Website with tracking charts | Not stated | None to view; check the site's terms before reusing data | Eviction-risk context for tenant help tools (covers the city and St. Louis County) |
| 15 | CDC PLACES (local health estimates) | https://www.cdc.gov/places/index.html | Website; data on data.cdc.gov (**download link unverified**) | Yearly (not confirmed) | None | Tract-level health needs such as asthma or diabetes, joined with housing data |

## Couldn't confirm

- **SLMPD crime stats page** (`https://www.slmpd.org/crime-stats/`) returned "Sorry, this page doesn't exist." Use row 4 instead.
- **CDC PLACES download endpoint**: only the landing page was checked.

## Notes for kickoff

- Join key: most city data carries Parcel ID / Handle and a neighborhood or ward. Rows 10 and 11 tie it together.
- Coordinates in the 311 data are Web Mercator (EPSG:3857), not lat/long. Convert before mapping.
- The vacant-buildings API is slow. Pull once, save a CSV snapshot, and demo from that.
- Sample at most 20 rows into any LLM prompt. Aggregate first.
