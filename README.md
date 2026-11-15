# FireSense

NASA Space Apps 2026 — burning-activity calendar and experimental MODIS/VIIRS comparison built on NASA FIRMS detections.

| | |
|---|---|
| **Live demo** (no install) | https://likith17.github.io/firesense/ |
| **Submission deck** | [docs/FireSense-slides.pptx](docs/FireSense-slides.pptx) |
| **Methods** | [docs/METHODS.md](docs/METHODS.md) |
| **Verification** | [docs/VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md) |
| **Repository** | https://github.com/likith17/firesense |

The live demo is a self-contained offline build with embedded real-data snapshots for four preset selections. Arbitrary filtering and map dragging need the full app (the ~230 MB observation database is not in this repository).

## Run the full app

Node.js 24+. No `npm install` required.

```bash
git clone https://github.com/likith17/firesense.git
cd firesense
node src/server.js
```

Open http://127.0.0.1:8000. Set `HOST` and `PORT` for hosting. The active database is selected by `config/active-database.json`. The reconciled database (~29M observations) is not included here; original NASA FIRMS exports are preserved locally.

## Offline demo

Open `dist/FireSense-demo.html` in a browser — no server or network required. Same four presets and held-out evaluation as the Pages demo. This is not a live feed.

## Coverage

| Product | Historical export | Global export |
|---|---|---|
| MODIS Terra/Aqua | U.S., November 2000 onward | January 1–November 15, 2026 |
| VIIRS S-NPP | January 2012 onward, U.S.-consistent extent | January 1–November 2, 2026 |

Standard and NRT remain separate. Pre-2026 global coverage is incomplete. No NOAA-20 or NOAA-21 data have been imported.

## What it does

- Daily one-degree source-attributed aggregates with geographic/date/processing/confidence filters, zoomable grid, monthly calendar (counts / vs.-typical-month), seasonal profile, and raw sensor comparison
- Exact full-field deduplication across overlapping exports; conflicting identities abort rather than silently revise
- Reconciliation removed 8,466,238 duplicate rows among nonidentical files
- Experimental adjustment fitted on 2013–2021, selected on 2022, calibrated on 2023, evaluated on 2024–2025 in three U.S. boxes (72 held-out region-months: MAE 959.8 vs fitted-ratio MAE 1,101.4). Not validation of global transfer, early warning, or pre-2012 backcasting

## Reproduce

```bash
node --test
node src/audit.js
node src/evaluate.js
node src/package-demo.js
node src/smoke.js
```

New raw imports: run `node src/inspect.js` first. Build with `node src/reconcile.js data/processed/new-build.sqlite` (destination must not exist). Audit with `FIRESENSE_DB` before changing `config/active-database.json`.

## Deployment

The Dockerfile packages the app and reconciled database with Node 24 and a non-root runtime. Hosting needs a persistent Node process and ~250 MB database storage. The offline HTML is at https://likith17.github.io/firesense/. No credentials are included.

## Limitations

Grid cells have unequal ground area; selections use cell centers. No basemap, polygon selection, cloud/overpass correction, unique-fire estimation, fire-type classification, or operational forecast. The database keeps standard/NRT separate and does not implement revision replacement between them.
