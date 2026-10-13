# Data pipeline (Python)

This folder is the Python side of the project. Python scripts download St. Louis open data, clean it, and save JSON files. The website reads those JSON files. That's the only place Python and the website meet.

```
data/scripts/*.py   (you write these)
        │  download + clean
        ▼
app/data/clean/*.json   (the website reads these)
```

You never need to touch TypeScript or anything else in `app/`. You also don't need to run a server. Just run scripts.

## One-time setup (do this tonight)

**1. Install Python 3.11 or newer.**

- Windows: install from https://www.python.org/downloads/ and tick **"Add python.exe to PATH"** on the first screen.
- Mac: `brew install python`, or use the installer from python.org.
- Check it worked: open a terminal and run `python --version` (on Mac, `python3 --version`).

**2. Get the code.**

```bash
git clone <repo-url>
cd <repo-folder>
```

**3. Make a virtual environment.** This is a private box of Python packages just for this project, so it can't break anything else on your computer.

```bash
python -m venv .venv
```

Turn it on. Do this every time you open a new terminal:

- Windows (PowerShell): `.venv\Scripts\Activate.ps1`
- Mac / Linux: `source .venv/bin/activate`

Your prompt now starts with `(.venv)`.

**4. Install pandas.**

```bash
pip install -r data/requirements.txt
```

**5. Run the example script once.**

```bash
python data/scripts/fetch_lra_inventory.py
```

You should see something like:

```
Downloading https://static.stlouis-mo.gov/open-data/SLDC/REAL-ESTATE/LRA_INVENTORY.csv ...
  10349 rows, 29 columns
Saved 10346 parcels to app/data/clean/lra_inventory.json
Saved counts to app/data/clean/lra_summary.json
```

Open `app/data/clean/lra_summary.json` and look at it. If you got this far, you're set up. Tell Prahlad.

## During the hackathon

Once the team picks an idea:

1. Find the dataset in `research/stl-data.md`.
2. Copy `data/scripts/fetch_lra_inventory.py` to a new file, e.g. `data/scripts/fetch_311.py`.
3. Change `SOURCE_URL`, then rewrite `clean()` for the new columns. Read the first 20 rows before you decide what to clean.
4. Run it. Check the numbers against the city's website by hand.
5. Commit the script **and** the JSON it made in `app/data/clean/`, and open a pull request.

### Rules that save us at 2am

- **Always save a cleaned file.** The live demo reads our JSON, never the city website. City sites are slow and sometimes down.
- **Keep files small.** Drop columns nobody uses. If a file goes over about 5 MB, ask Prahlad.
- **Make a summary file too.** The AI gets the small summary file (counts, top 10 lists), not 10,000 rows.
- **Every number has a source.** Put the source page URL and download date in the summary, the way the example does.
- **Field names stay stable.** Once the website reads a field like `neighborhood`, don't rename it without telling the frontend person.
- **No personal data.** No names or contact details of residents, even if a dataset has them.

### Fact-checking

You also own every number in the pitch and the README. Before the video is recorded, check each stat against your JSON and the source page, and write where it came from in the team notes.

## Common problems

| Problem | Fix |
|---|---|
| `python: command not found` | On Mac use `python3`. On Windows, reinstall and tick "Add to PATH". |
| `No module named pandas` | The virtual environment isn't on. Run the activate command from step 3. |
| PowerShell says scripts are disabled | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then activate again. |
| `AssertionError: only 0 parcels` | The download failed or the city changed the file. Open the URL in a browser and check. |
| Parcel IDs lose their leading zeros | Read the CSV with `dtype=str`, as the example does. |
