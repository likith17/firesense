# Submission readiness

## Completed November 15, 2026 (verification pass — see docs/VERIFICATION_REPORT.md)

- Full end-to-end verification: 9/9 unit tests, real-data audit, 35/35 API probe cases, independent SQL cross-checks of totals/boundaries/strata, byte-identical reproduction of the held-out evaluation.
- Actual desktop and mobile (390px) browser verification of the full app: presets, drag/zoom selection, calendar, seasonal profile, comparison, evaluation view, source ledger, empty states, error recovery, stale-response handling, exports. Screenshots in `outputs/screenshots/`. No console errors.
- Offline demo verified interactively (served copy of the single file; fetch fully stubbed): presets, comparison, CSV/provenance exports match real-data snapshots. No external assets. True `file://` open was blocked by tooling, not by the artifact.
- Docker image built and smoke-tested: non-root, full database inside, correct API responses, 400-handling verified in-container. Base image pulled through mirror.gcr.io because Docker Hub was unreachable on this network.
- Fixed a critical defect: any invalid API parameter crashed the server process (header-ordering bug). Added a real-HTTP regression test. Also fixed: presets not resetting confidence, offline-demo brand link escaping the file, absolute DB path exposed by /api/evaluation, selection-outline stroke scaling.
- Official Project Submission Guide re-verified November 15: demo is ≤30-second video or ≤7 slides, public login-free links, English, submit before Sunday November 15 11:59 p.m. local event time. The challenge page itself returned HTTP 500 to automated fetch today.

## Required before submission (external, team action)

1. Publish a public final-project URL with no login. Options: run the verified container on any Node-24-capable host (~250 MB storage), or static-host `dist/FireSense-demo.html`.
2. Record the ≤30-second demo video from the verified UI (script in docs/DEMO_SCRIPT.md) or prepare ≤7 slides; host publicly; English subtitles if narrated in another language.
3. Supply the exact registered team/project page URL and confirm the Team Owner's event timezone.
4. Team Owner completes portal fields (summary, demo link, project link, NASA data, SI-use disclosure), accepts terms, and clicks "Submit for Judging" before the deadline. Local judging may close earlier — check with the Local Lead.

## Software defects

- None known after the verification pass. Known non-defect limits: synchronous SQLite serializes requests (trivial request can wait ~2 s behind a worst-case full-history world query); antimeridian boxes must be split into two queries (explicit error).

## Scientific / scope gaps (disclosed in-product; not claimed as capabilities)

- Global history before 2026 is absent; historical exports are U.S.-focused. Confirm request metadata for historical S-NPP 851143 (detected extent is consistent with U.S. coverage but is not a boundary guarantee).
- NOAA-20/21 not imported. Backfilling global history and additional platforms requires new FIRMS exports, preflight inspection, and a full rebuild.
- The MODIS→VIIRS mapping is validated only for three U.S. regions, 2024–2025, standard processing. Geographic transfer, observation-opportunity correction, pre-2012 backcasting, and any risk/forecast use remain unvalidated and unclaimed.
- No basemap or polygon selection; grid cells have unequal ground area and selections use cell centers.
- Live NASA FIRMS retrieval (MAP_KEY) and standard/NRT revision replacement are not implemented. No secret is needed for anything that currently ships.

## References

- https://www.spaceappschallenge.org/2026/
- https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/
- https://www.spaceappschallenge.org/resources/project-submission-guide/ (fetched November 15, 2026)
- https://firms.modaps.eosdis.nasa.gov/content/active_fire/
- https://firms.modaps.eosdis.nasa.gov/download/
