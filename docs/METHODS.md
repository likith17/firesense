# Reproducible methods

## Inputs and preservation

Raw NASA exports live in `data/raw`; original ZIPs remain at the root. `node src/inspect.js` streams every CSV, verifies columns and records, calculates file hashes, and reports date ranges, detected extents and possible overlaps. Detection extents do not prove request boundaries or complete observations.

## Reconciliation

`node src/reconcile.js data/processed/new-build.sqlite` creates a new database and refuses to overwrite an existing destination. It verifies each input hash against the preflight report. Inputs must be date sorted; a backwards date aborts the transaction. A multiway date merge holds only a day's records in memory. Exact full-field records are compared after ordering column names, within product and processing. Equivalent rows with different numeric formatting are not normalized. Byte-identical files are skipped and documented as aliases. Duplicate attribution follows preflight source order.

An identity includes product, processing, satellite, date, padded acquisition time, latitude and longitude. Different payloads for that identity across files abort the build rather than assuming which revision is correct. Standard and NRT remain separate strata. Revision replacement across processing classes and automated rolling updates remain unsupported.

Eight input rows have negative FRP and are excluded under the current quality policy, even from count summaries. Raw rows are retained so that this policy can be revised. Other quality checks cover coordinates, dates, acquisition times, satellite labels, confidence and agreement between processing filenames and version labels.

## Aggregates and interpretation

Daily one-degree cells retain source attribution, platform, detection count, summed FRP and nominal/high count. Source versions remain in the ledger; version-specific daily queries are not exposed. Bounding boxes include cells by their centers, west/south inclusive and east/north exclusive. Equal angular cells do not have equal ground area. Counts are detections, not unique fires, burned area, verified wildfire occurrences or density. Missing records remain unknown.

## Experimental calibration

Three U.S. regional bounding boxes use standard data and paired positive monthly counts. MODIS uses confidence >=30 and VIIRS uses n/h; these are not equivalent probability thresholds. The candidate models are raw identity, a global training ratio, and log1p-linear regression. Parameters are fitted using only 2013-2021. Mean absolute error on 2022 chooses the model. The 90% absolute-residual quantile (finite sample order statistic) on 2023 supplies a symmetric residual interval clipped at zero. Final metrics use only 2024-2025 and report MAE, RMSE, signed bias and empirical interval coverage.

Temporal and spatial dependence, varying platform contributions, instrument/version changes, non-vegetation hotspots and unequal observation opportunity limit interpretation. The fit is only displayed for the evaluated region-months. Geographic generalization, pre-2012 backcasting, anomaly risk scores and operational forecasts are not established.

## Run and verify

1. Install Node.js 24 or newer.
2. `node --test`
3. `node src/audit.js`
4. `node src/evaluate.js`
5. `node src/package-demo.js`
6. `node src/server.js`, then open http://127.0.0.1:8000.

`config/active-database.json` selects the audited database. `FIRESENSE_DB` can override it for a candidate build. After changing the active database, restart the server. Never promote a failed or unaudited candidate database.
