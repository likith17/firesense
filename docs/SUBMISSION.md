# FireSense: see burning activity through time

## High-level summary

FireSense turns NASA FIRMS hotspot exports into an auditable burning activity calendar. Users explore global 2026 observations and U.S. historical records, select geographic bounds and dates, compare MODIS with VIIRS, and inspect an experimental sensor adjustment evaluated on separate years. Every view distinguishes observations from inference and standard archives from provisional near-real-time data.

## Problem and solution

A higher hotspot count does not necessarily mean more burning: sensors have different detection characteristics, repeat observations, and unequal observation opportunity. FireSense makes those differences visible instead of silently joining incompatible counts. It preserves raw files, records source hashes, removes exact duplicate rows across overlapping exports, and builds daily one-degree summaries for interactive calendars.

The app supports a global geographic domain, with worldwide MODIS and S-NPP exports for available 2026 dates. Historical coverage is currently U.S.-focused: MODIS begins in November 2000; the supplied historical S-NPP export begins in January 2012 and has an extent consistent with the U.S. The historical request footprint still needs confirmation. Global historical backfill remains a project goal, not a completed claim.

## What works

- Local Node.js app with date, processing, confidence, and bounding-box filters; grid zoom and drag selection; monthly calendars and seasonal summaries.
- 28,789,421 retained hotspot observations; 8,466,238 exact duplicate rows removed among the nonidentical input files. One additional byte-identical NRT export is skipped entirely. These are not counts of unique fires.
- Source hashes, platforms, versions, quality exclusions, and duplicate attribution remain auditable. Eight rows fail the current negative-FRP policy. Raw ZIPs and CSVs remain unchanged.
- Raw MODIS/S-NPP comparisons and an experimental adjusted calendar in three regional bounding boxes.
- Offline, self-contained demo with fixed real-data case selections, plus a portable server package.

## Experimental result

Train on 2013-2021, select the model on 2022, estimate an absolute-residual interval from 2023, and test once on 2024-2025. The three study boxes are California, the Pacific Northwest, and the southeastern U.S.; these are not exact state boundaries or verified fire-type labels.

The selected log-linear mapping predicts monthly VIIRS nominal/high hotspot counts from monthly MODIS confidence >=30 counts. On 72 held-out region-months, MAE is 959.8 detections, compared with 1,101.4 for a training-fitted ratio and 3,617.4 for raw MODIS counts used without adjustment. That is 12.9% lower MAE than the ratio baseline and 73.5% lower than the raw baseline. Bias is -391.4 detections, so the model still underestimates on average. The empirical residual interval covers 90.3% of held-out observations; this is an observed result, not a guaranteed coverage claim.

We do not extrapolate the mapping globally, before 2012, or to NRT observations. Cloud/overpass normalization and geographic holdout are not implemented. Months without qualifying detections in either sensor are excluded rather than filled with zeros. The three evaluation boxes happen to have paired observations in all months used, but this does not establish complete satellite coverage. Full metrics and per-month predictions are in `outputs/evaluation.json`.

## NASA and other resources

- Challenge: https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/
- NASA FIRMS archive and source exports: https://firms.modaps.eosdis.nasa.gov/download/
- NASA active-fire downloads: https://firms.modaps.eosdis.nasa.gov/content/active_fire/
- NASA VIIRS product description: https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html
- NASA detection caveats: https://firms2.modaps.eosdis.nasa.gov/alerts/notes.php
- Supplied requests: 851088, 851089, 851143, 851144, 851145. Source-specific SHA-256 values are in `outputs/reconciliation.json` and the downloadable provenance ledger.
- Node.js built-in SQLite, HTTP, filesystem and streaming libraries. No paid API or model inference is needed to run the demo.

## AI-use disclosure

OpenAI ChatGPT/Codex assisted with project planning, software implementation, debugging, automated tests, data-quality checks, evaluation design, and drafting the documentation. All displayed observational counts are computed from the supplied NASA FIRMS exports; synthetic test fixtures are isolated from the real-data database. The experimental regression is a fitted statistical mapping, not a language-model-generated observation. Human review and final submission approval remain necessary.

## Submission fields still requiring team input

- Exact registered team/project URL, team name and members.
- Public final-project/repository or hosted demo URL; localhost and local file links are not accessible to judges.
- Public short-demo URL. Use the 30-second script in `docs/DEMO_SCRIPT.md` or prepare a presentation within the applicable slide limit.
- Check the Team Owner's event timezone and any earlier local judging deadline; the official 2026 page lists November 15 at 11:59 p.m. local time for project submission.
- Final portal review, terms acceptance, and Submit for Judging action are not completed by this package.

## Remaining limitations to disclose

No operational fire forecast, automatic alerts, cloud/overpass normalization, burned-area estimates, or validated fire-type classification. Global history before 2026 is incomplete. Map selections use one-degree cell centers and the current atlas has a coordinate grid, not a geographic basemap or administrative polygons. Live retrieval is not configured. Desktop/mobile browser verification and a container smoke test were completed November 15, 2026 (docs/VERIFICATION_REPORT.md); public hosting, the recorded demo, and portal submission remain outstanding.
