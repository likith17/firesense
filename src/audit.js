import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDb,ROOT} from './db.js';
import {sourceStatus,queryDashboard,parseFilters} from './queries.js';
const db=openDb();
try {
 const report={generated_at:new Date().toISOString(),...sourceStatus(db),checks:[]};
 for(const source of report.sources){
  const aggregate=db.prepare('SELECT COALESCE(SUM(detections),0) rows FROM daily WHERE source_id=?').get(source.id);
  if(aggregate.rows!==source.rows)throw new Error('Aggregate count mismatch: '+source.name);
 }
 for(const product of ['modis','viirs_snpp'])for(const processing of ['standard','nrt']){
  const start=performance.now(),data=queryDashboard(db,parseFilters(new URLSearchParams({product,processing})));
  const gridTotal=data.grid.reduce((n,r)=>n+r.detections,0),calendarTotal=data.calendar.reduce((n,r)=>n+r.detections,0);
  if(gridTotal!==calendarTotal||gridTotal!==data.summary.detections)throw new Error('View totals mismatch');
  report.checks.push({product,processing,rows:gridTotal,months:data.calendar.length,cells:data.grid.length,query_ms:Math.round(performance.now()-start)});
 }
 const reconciled=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reconciliation'").get();
 if(reconciled){
  const mismatches=db.prepare('SELECT s.name FROM reconciliation r JOIN sources s ON s.id=r.source_id WHERE r.accepted<>s.rows+r.duplicates OR r.rejected<>s.rejected').all();
  if(mismatches.length)throw new Error('Reconciliation ledger mismatch');
  report.deduplication=db.prepare('SELECT SUM(accepted) accepted_before_deduplication,SUM(duplicates) duplicate_rows_removed FROM reconciliation').get();
 }
 report.quality_policy='Invalid coordinates, dates, satellite, confidence, processing or negative/missing FRP exclude the record. Original rows remain in CSVs. '+(reconciled?'Exact full-field duplicates removed within product/processing; conflicting overlapping identities block the rebuild.':'Legacy index: within-file deduplication is not performed.');
 mkdirSync(resolve(ROOT,'outputs'),{recursive:true});writeFileSync(resolve(ROOT,'outputs/data-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({rows:report.rows,rejected:report.rejected,checks:report.checks},null,2));
}finally{db.close();}
