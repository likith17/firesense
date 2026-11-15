// Independent cross-check of API results against direct SQL (not part of the app).
import {openDb} from '../src/db.js';
const db=openDb();
const q=(sql,...a)=>db.prepare(sql).get(...a);
const out={};
// 1. Total retained rows equals sum of per-source rows and sum of daily detections.
out.sources_total=q("SELECT SUM(rows) n FROM sources WHERE status='ready'").n;
out.daily_total=q('SELECT SUM(detections) n FROM daily').n;
// 2. CA 2020 VIIRS standard, independent SQL mirroring documented bbox semantics (center-inclusive west/south, exclusive east/north).
out.ca2020=q(`SELECT SUM(d.detections) n, MIN(d.date) first, MAX(d.date) last FROM daily d JOIN sources s ON s.id=d.source_id
 WHERE s.status='ready' AND s.product='viirs_snpp' AND s.processing='standard'
 AND d.date>='2020-01-01' AND d.date<='2020-12-31'
 AND d.x-179.5>=-125 AND d.x-179.5<-114 AND d.y-89.5>=32 AND d.y-89.5<42`);
// 3. Date boundary inclusivity: single-day query vs BETWEEN endpoints.
out.single_day=q(`SELECT SUM(d.detections) n FROM daily d JOIN sources s ON s.id=d.source_id
 WHERE s.status='ready' AND s.product='viirs_snpp' AND s.processing='standard' AND d.date='2020-12-31'
 AND d.x-179.5>=-125 AND d.x-179.5<-114 AND d.y-89.5>=32 AND d.y-89.5<42`);
out.without_last_day=q(`SELECT SUM(d.detections) n FROM daily d JOIN sources s ON s.id=d.source_id
 WHERE s.status='ready' AND s.product='viirs_snpp' AND s.processing='standard' AND d.date BETWEEN '2020-01-01' AND '2020-12-30'
 AND d.x-179.5>=-125 AND d.x-179.5<-114 AND d.y-89.5>=32 AND d.y-89.5<42`);
// 4. Standard vs NRT kept separate: no source mixes them, and overlapping dates exist in both strata.
out.processing_strata=db.prepare("SELECT processing,COUNT(*) files,SUM(rows) rows,MIN(min_date) min,MAX(max_date) max FROM sources WHERE status='ready' GROUP BY processing").all();
// 5. Nominal counts never exceed detections.
out.nominal_violation=q('SELECT COUNT(*) n FROM daily WHERE nominal>detections').n;
// 6. FRP: negative FRP must not exist in aggregates (policy excludes them).
out.negative_frp_cells=q('SELECT COUNT(*) n FROM daily WHERE frp<0').n;
// 7. Grid bounds sane.
out.grid_bounds=q('SELECT MIN(x) minx,MAX(x) maxx,MIN(y) miny,MAX(y) maxy FROM daily');
// 8. Reconciliation ledger totals.
out.recon=q('SELECT SUM(accepted) accepted,SUM(duplicates) dups,SUM(rejected) rejected FROM reconciliation');
// 9. Pre-2026 non-U.S. coverage really absent? Count standard detections before 2026 outside a broad US box.
out.pre2026_outside_us=q(`SELECT SUM(d.detections) n FROM daily d JOIN sources s ON s.id=d.source_id
 WHERE s.status='ready' AND d.date<'2026-01-01' AND NOT (d.x-179.5>=-170 AND d.x-179.5<-60 AND d.y-89.5>=18 AND d.y-89.5<72)`);
console.log(JSON.stringify(out,null,1));
db.close();
