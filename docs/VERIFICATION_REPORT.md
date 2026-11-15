# FireSense verification report

Date: November 15, 2026. Verifier: automated end-to-end audit (code inspection, unit tests, independent SQL cross-checks, live API probing, real browser interaction, container smoke test). Machine: Windows 11 (win32 10.0.26200), Node.js v24.10.0, Docker Engine 29.6.1.

## 1. Overall verdict: READY WITH LIMITATIONS

The application, data pipeline, scientific evaluation, offline demo, and container all work and were verified against independent evidence. One critical server defect was found and fixed (any invalid API parameter crashed the whole process). The remaining blockers are external submission tasks (public hosting, demo recording, portal fields) and documented scientific/data-scope limitations, not software defects. The project must not be described as fully submission-ready until the items in section 7 are complete.

## 2. Behavior matrix

Evidence keys: [T] = `node --test` (9/9 pass), [A] = `node src/audit.js` output, [S] = `node src/smoke.js`, [P] = API probe (`outputs/api-probe.mjs`, 35/35 pass), [D] = independent SQL (`outputs/db-crosscheck.mjs`), [B] = live browser observation with screenshots in `outputs/screenshots/`, [F] = performance probe (`outputs/perf-probe.mjs`), [C] = Docker container smoke test.

| Feature | Test case | Expected | Observed | Evidence | Result |
|---|---|---|---|---|---|
| Startup | Cold start to first response | Listens quickly | 112 ms | F | PASS |
| Initial load | Default view (VIIRS S-NPP, standard, world, 2026-01-01 to 2026-07-31) | Map, calendar, stats render | 8,859,653 detections, 11,960 cells, world map renders continents | B: full-app-initial-world.png | PASS |
| Presets | All four preset buttons | Apply canonical filters and query | California 1,018,371 / Northwest 756,666 / Southeast 981,020 / World 8,859,653, identical in app and demo snapshots | B, demo build output | PASS |
| Presets | Preset after user changed confidence | Reproducible preset selection | BUG (fixed): confidence was not reset; now resets to "all" and matches snapshot counts | B retest | PASS (after fix) |
| Map | Drag box selection | bbox set from drag, query runs | Drag 20–35%/30–50% gave exactly -108,0,-54,36 and refreshed (593,530) | B (synthetic pointer events; OS-level drag not scriptable on the SVG) | PASS |
| Map | Zoom in/out, fit selection, world view | viewBox updates | Fit selection framed California cells; reset restored world | B: full-app-fit-selection-zoom.png | PASS |
| Map | Selection outline at zoom | Readable outline | Stroke scaled with zoom (cosmetic); fixed with non-scaling stroke | B retest | PASS (after fix) |
| Calendar | Multi-year heatmap (CA 2013–2025) | 13 year rows, month cells, — for no data | 13 rows + header; fire seasons visible; "—" tooltip says "not a verified zero" | B: full-app-calendar-california.png | PASS |
| Dates | Inclusive boundaries | BETWEEN inclusive both ends | 242,843 (through Dec 30) + 46 (Dec 31 alone) = 242,889 (full year) | D | PASS |
| Dates | Reversed range in UI | Clear error, no crash, state recovers | "Start date is after end date"; previous view retained | B | PASS |
| Dates | Impossible date (2020-02-30), bad format | HTTP 400 | 400 with error JSON | P | PASS |
| Bbox | Malformed/out-of-range/antimeridian/zero-width | HTTP 400 with explicit antimeridian message | All 400; antimeridian limitation stated in the error | P | PASS |
| Antimeridian | Crossing bbox | Not supported; explicit | Rejected with "split antimeridian areas into two queries" | P | PASS (documented limitation) |
| Products | viirs_snpp / modis standard+nrt | Counts match audit | 16,010,047 / 5,368,264 / 6,602,253 / 808,857 — identical in audit, API, UI | A, P, B | PASS |
| Products | NOAA-20/21 (not imported) | Empty result, honest scope note | 0 rows; scope line "This product has not been imported yet." behavior via coverage map; no fake data | P, B | PASS |
| Confidence | nominal vs all | nominal ≤ all, never nominal>detections | 14,704,553 vs 16,010,047 world; 0 violations in DB | P, D | PASS |
| Processing | standard vs NRT separation | Separate strata, badge switches | NRT badge "PROVISIONAL / NRT"; strata overlap only Aug 2026 and are never summed together | B, D | PASS |
| Empty results | Amazon 2019 (no pre-2026 non-U.S. coverage) | "No records", not zero-claims | "Unavailable" count, 0 cells, message distinguishes missing coverage from zero fire | B | PASS |
| Stale responses | Slow world query then fast CA query | Newer result wins | After slow response returned, view still showed CA 242,889 | B | PASS |
| Comparison | CA 2013–2025 | Month-aligned raw counts, nulls as "Unavailable" | 156 rows, both sensors, no adjustment applied | B, S | PASS |
| Comparison | Empty selection | Note, no table | "No qualifying detections for either sensor" path returns 200 with empty rows | P | PASS |
| Evaluation view | Metrics and per-region adjusted calendars | Match outputs/evaluation.json; only evaluated region-months shown | loglinear, MAE 960, 73.5% vs raw, 12.9% vs ratio, 90.3% coverage, 72 pairs; details tables only render test_predictions | B: full-app-evaluation-ledger.png | PASS |
| Exports | /api/export.csv vs selected view | Totals equal dashboard summary | CSV rows sum to summary.detections; filters echoed in columns | S, P | PASS |
| Exports | Provenance JSON | 9 sources, hashes, dedup counts | 9 sources, 28,789,421 rows | P, S | PASS |
| Errors | Invalid API parameter | 400 JSON error, server keeps running | BUG (fixed): previously crashed the entire Node process (ERR_HTTP_HEADERS_SENT); now 400 and alive | P, T (new regression test) | PASS (after fix) |
| Security | Path traversal (`/../package.json`, encoded) | 404 | 404 (static files served from a fixed whitelist map) | P | PASS |
| Security | SQL injection | Parameterized everywhere | All queries use prepared statements with bound parameters; filters are validated enums/numbers | code review | PASS |
| Security | XSS / CSV formula injection | No unsafe rendering | Frontend uses textContent exclusively; demo escapes `<`; CSV fields are enums/numbers only (no user text) | code review | PASS |
| Security | Secrets / path exposure | None served | No MAP_KEY or secret anywhere; BUG (fixed): /api/evaluation leaked the absolute local DB path, now repo-relative | grep, P | PASS (after fix) |
| Mobile | 390×844 viewport | No page overflow, readable | document scrollWidth = 390; tables scroll internally; layout stacks | B: full-app-mobile-390px.png | PASS |
| Accessibility | Keyboard/console basics | Native controls, no JS errors | 25 native focusable controls, no positive tabindex, zero JS errors during the whole session | B | PASS (basic checks only) |
| Offline demo | Rebuild + no external assets | Single self-contained file | 664,636 bytes, 1 inline script, 0 external stylesheets/images; only anchors + NASA credit link remain; offline banner shows snapshot timestamp | demo-scan, B: offline-demo.png | PASS |
| Offline demo | Presets, comparison, exports | Match real-data snapshots | California 1,018,371; CSV export parses and sums exactly to displayed total; provenance JSON has 9 sources; comparison 156 rows | B (served copy of the file; fetch fully stubbed) | PASS |
| Offline demo | Arbitrary filtering disabled | Not implied to work | Filter form hidden, map pointer-events disabled, banner says "four fixed selections"; BUG (fixed): brand link href="/" would navigate away from the offline file, now "#" | B, code | PASS (after fix) |
| Offline demo | Open from file:// with network disabled | Works | BLOCKED in this environment: the browser tool refuses file:// URLs. Verified instead by serving the identical single file and confirming zero additional asset requests plus full fetch stubbing. Not equivalent to a true offline file:// observation. | B | BLOCKED (close proxy passed) |
| Docker | Build + run + smoke | Non-root, DB included, API works | Built (base image via mirror.gcr.io because Docker Hub was network-blocked); 28,789,421 rows served, 400-handling verified, uid=1000(node) | C | PASS |
| Performance | Representative queries | Measured, no invented targets | CA year 35 ms (2 ms cached); world 2026 857 ms; worst-case full-history world 2.6 s; 8 concurrent regional queries 355 ms total; tiny request stalls ~2.0 s behind a heavy query (synchronous SQLite) | F | PASS (limitation documented) |
| Live retrieval | NASA MAP_KEY | Absent per docs | No key configured or referenced in code; no live retrieval path exists; offline use needs no key | grep | PASS (documented as not implemented) |

NOT TESTED: true file:// offline open (tool restriction, see above); load beyond 8 concurrent clients; non-Chromium browsers; screen readers.

## 3. Bugs found, fixes, and regressions

1. **Critical — server crash on any invalid API parameter.** `src/server.js` called `res.writeHead(400/404)` and then `json()` which called `setHeader`, throwing `ERR_HTTP_HEADERS_SENT` and killing the whole process. Any user submitting a reversed date range or bad bbox took the service down (reproduced live: ECONNRESET, process exit 1). Prior tests missed it because the fake response object did not enforce Node's header ordering. Fixed by passing the status code through `json()` via `writeHead(status, headers)` and guarding `headersSent` in the catch path. Regression: new real-HTTP test in `tests/api.test.js` exercises four invalid requests against an actual `node:http` server and asserts the server still answers afterwards. All 9 tests pass; API probe 35/35.
2. **Medium — presets did not reset the confidence filter**, so "demo preset" results depended on earlier UI state and would not match the published snapshot counts. Fixed in `web/app.js`; verified live (preset after setting "nominal" now yields the canonical 1,018,371).
3. **Low — offline demo brand link (`href="/"`)** navigated away from the standalone file. Fixed in `src/package-demo.js`; demo rebuilt.
4. **Low — `/api/evaluation` exposed the absolute local database path.** `src/evaluate.js` now records a repo-relative path. Evaluation regenerated; all metrics byte-identical.
5. **Cosmetic — selection outline stroke scaled with map zoom.** Added `vector-effect: non-scaling-stroke`.

No data-pipeline, aggregation, or scientific-evaluation defects were found.

## 4. Data and scientific reconciliation

- Totals agree across four independent paths: source ledger sum, raw `daily` aggregate sum, `/api/status`, and UI header = 28,789,421. Reconciliation ledger: 37,255,659 accepted − 8,466,238 duplicates = 28,789,421 retained; 8 rejected (negative FRP). No negative-FRP or nominal>detections rows exist in aggregates. Grid indices within bounds (x 0–359, y 2–175).
- Spot check (California, VIIRS standard, 2020): UI = API = independent SQL = 242,889; date boundaries inclusive on both ends.
- Documented coverage holds: standard 2000-11-01→2026-08-31, NRT 2026-08-01→2026-11-15, overlapping only in August 2026 and kept in separate strata (no double counting; UI/CSV/comparison always select one processing class). Pre-2026 detections outside a broad North-America box: 346 of 28.8M — "U.S.-focused history" is accurate.
- Evaluation reproduced byte-identically (excluding timestamp): loglinear slope 0.8806, intercept 2.1350; test n=72, MAE 959.8, RMSE 1902.8, bias −391.4; ratio baseline MAE 1,101.4 (12.9% improvement), identity 3,617.4 (73.5%); interval radius 2,223.8 with 90.3% empirical coverage from 36 calibration pairs. Split hygiene verified in code: fit on <2022 only; selection on 2022; interval from 2023; 2024–2025 used once. Baselines are fitted on the same training data (fair). Pair-exclusion of missing months is disclosed as a potential bias. The UI renders adjusted values only for the 72 evaluated region-months — no silent extrapolation to other areas, periods, NRT, or global scope. No forecast/early-warning/harmonization claims appear anywhere in the UI or docs; limitations (unequal cell area, observation opportunity, cloud/overpass, detections≠fires) are displayed.

## 5. Browser and performance evidence

Screenshots in `outputs/screenshots/`: `full-app-initial-world.png`, `full-app-calendar-california.png`, `full-app-fit-selection-zoom.png`, `full-app-evaluation-ledger.png`, `full-app-mobile-390px.png`, `offline-demo.png`. Performance (this machine, local loopback, single process): cold start 112 ms; regional-year dashboard 35 ms (cached 2 ms); global 2026 857 ms; worst-case full-history world 2,584 ms; 13-year comparison 591 ms; 8 concurrent uncached regional queries complete in 355 ms wall. Synchronous SQLite serializes requests: a trivial request waited ~1,990 ms behind a full-history world query. Appropriate for local/demo use; not validated for high public concurrency.

## 6. Full app vs offline demo

Full app (Node 24 + 230 MB database): arbitrary bbox/drag/zoom selection, any date range, all products/processing/confidence, live queries, CSV/provenance export, evaluation view. Offline demo (single 665 KB HTML): the same UI restricted to four fixed real-data snapshots (world 2026, California, Pacific Northwest, Southeast 2013–2025), evaluation view, source ledger, snapshot-scoped CSV/provenance export; filter form and map interaction are disabled and the banner states the snapshot timestamp and restriction. Demo counts equal full-app counts for identical selections (verified both ways).

## 7. Remaining blockers (not software defects)

External submission tasks — require team action:
1. Public, login-free final-project URL (host the container or static-host `dist/FireSense-demo.html`). Nothing is deployed.
2. Project demo: ≤30-second video or ≤7 slides, hosted publicly, English (subtitles if spoken otherwise). Script exists; no recording.
3. Registered team/project page URL, team details, SI-use disclosure fields, terms acceptance, and the "Submit for Judging" click — deadline Sunday November 15, 11:59 p.m. local event time (verified from the official Project Submission Guide on Nov 15, 2026; the challenge page itself returned HTTP 500 to automated fetch today).

Scientific/data scope (documented, disclosed in-product):
- Global history before 2026 is absent; historical data are U.S.-focused. NOAA-20/21 not imported. No cloud/overpass/observation-opportunity correction. Harmonization is a regional experiment, not a global capability. Live FIRMS retrieval (MAP_KEY) and standard/NRT revision replacement are not implemented.

## Addendum — UI presentation pass (Nov 15, ~4:00 p.m. ET)

After the main verification, four presentation upgrades were added and retested (9/9 tests, smoke pass, demo rebuilt, verified live in-browser in the full app and the rebuilt offline demo, zero console errors):
1. Calendar "Counts / Vs. typical month" toggle: each month vs the median of the same calendar month across the other selected years, diverging orange/blue ramp, honest tooltips and caption ("descriptive within this selection only, not a coverage-corrected anomaly"; "·" marks months with no other year to compare). Evidence: `outputs/screenshots/full-app-anomaly-calendar.png` (California 2013–2025: Aug 2021 +92.3K, Sep 2020 +123.5K, Jan 2025 +3K vs typical).
2. Proportional inline bars in the MODIS/VIIRS comparison table (blue MODIS, orange VIIRS; scaled to the table maximum).
3. Loading state: spinner next to the status line and dimmed map/calendar/seasonal panels while a query is in flight.
4. Active-preset highlighting via `aria-pressed` (cleared on any manual filter change); "Global 2026" marked on initial load.
