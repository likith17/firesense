# FireSense

NASA FIRMS burning-activity calendar and experimental MODIS/VIIRS comparison.

- **Live demo (no install):** https://likith17.github.io/firesense/
- **Submission slides:** https://likith17.github.io/firesense/slides.html
- **Repository:** https://github.com/likith17/firesense

The live demo is the self-contained offline build with embedded real-data snapshots for four preset selections. Arbitrary filtering and map dragging require the full app below (the 230 MB observation database is not in this repository; raw NASA FIRMS exports are preserved locally).

## Run the full app

Node.js 24 or newer. No npm install is required.

```powershell
git clone https://github.com/likith17/firesense.git
cd firesense
node src/server.js
```

Open http://127.0.0.1:8000. The default bind is localhost. Set HOST and PORT explicitly for hosting.
The active database is selected by config/active-database.json. The reconciled database has 28,789,421 observations and is not included in this repository (see Deployment). Original files and the old database are preserved locally.

## Offline demo

Open dist/FireSense-demo.html in a browser. It embeds real-data snapshots for four preset selections and the held-out evaluation. It needs no server or network. Arbitrary geographic/date filtering and map dragging require the full app. Snapshot exports and the source ledger are included. This is not a live feed.

## Actual coverage

| Product | Historical export | Global export |
|---|---|---|
| MODIS Terra/Aqua | U.S., November 2000 onward | January 1-November 15, 2026 |
| VIIRS S-NPP | January 2012 onward, U.S.-consistent extent; request footprint confirmation pending | January 1-November 2, 2026 |

Standard and NRT remain separate. Dates and extents do not establish complete observation opportunity. Pre-2026 global coverage is incomplete. No NOAA-20 or NOAA-21 data have been imported.

## Implemented

- Daily one-degree source-attributed aggregates, geographic/date/processing/confidence filters, zoomable grid, monthly calendar with a counts / vs.-typical-month (median of the same calendar month across the other selected years) toggle, seasonal profile, raw sensor comparison with proportional bars, CSV and provenance exports.
- Exact full-field deduplication across overlapping exports, including duplicates within files; conflicting overlapping identities abort rather than silently choosing a revision.
- Reconciliation removed 8,466,238 duplicate rows among nonidentical files. One byte-identical NRT file is separately skipped. Eight negative-FRP rows are excluded by the current policy.
- Experimental adjustment fitted on 2013-2021, selected on 2022, interval calibration on 2023, final evaluation on 2024-2025 in three U.S. boxes.
- 72 held-out region-months: MAE 959.8, versus fitted-ratio MAE 1,101.4 (12.9% lower). This is not validation of global transfer, early warning, or pre-2012 backcasting.

## Reproduce

```powershell
node --test
node src/audit.js
node src/evaluate.js
node src/package-demo.js
node src/smoke.js
```

New raw imports: run node src/inspect.js first. Build a fresh database with node src/reconcile.js data/processed/new-build.sqlite. The destination must not exist. Audit it using FIRESENSE_DB before changing config/active-database.json. Do not use the legacy ingest.js for overlapping exports. A new preflight report and full rebuild are required for additional sources.

## Deployment

The Dockerfile packages the app and reconciled database with Node 24 and a non-root runtime. The container was built and smoke-tested on November 15, 2026 (full database served, non-root, error handling verified). A hosting service must support a persistent Node process and roughly 250 MB of database storage plus working space. The offline HTML is already hosted at https://likith17.github.io/firesense/ (four documented presets only). No credentials are included.

## Limitations

Grid cells have unequal ground area and selections use cell centers. No basemap, polygon selection, cloud/overpass correction, unique-fire estimation, fire-type classification, or operational forecast. Version/platform details remain in the source ledger; daily version filtering is not exposed. The database keeps standard/NRT separate and does not implement revision replacement between them.

See docs/METHODS.md and docs/VERIFICATION_REPORT.md. All automated tests, real-data checks, API probes, and a full desktop/mobile browser verification pass (November 15, 2026, with screenshots).
