# FireSense project instructions

- Work in `D:\Projects\spaceapps-firms`. Do not create a parallel project under the user profile.
- Target global coverage, all available history and recent observations. Regional subsets are test cases, not the final scope.
- Preserve original NASA ZIPs and CSVs. Do not overwrite or delete raw data during reprocessing.
- Keep sensor/platform, product version, standard/NRT processing and source provenance explicit.
- Never present synthetic fixtures as observations, missing records as verified zeros, raw detections as unique fires, or an unvalidated mapping as scientific harmonization.
- Before new imports, inspect the product, schema, dates, footprint and overlap with existing sources.
- Run `node --test` for logic changes and `node src/audit.js` after real-data ingestion changes.
- Record remaining blockers honestly in `docs/NEXT_STEPS.md`. Do not claim visual verification without observing the browser UI.
