import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDb} from '../src/db.js';
import {ingestFile} from '../src/ingest.js';
import {inspectFile} from '../src/inspect.js';
import {queryComparison,queryDashboard,parseFilters} from '../src/queries.js';
const header='latitude,longitude,acq_date,acq_time,satellite,confidence,version,frp';
test('preflight detects identical files and overlaps without changing the ledger',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'firesense-preflight-')),db=openDb(join(dir,'test.sqlite'));
 try{
  const file=join(dir,'fire_archive_test.csv');writeFileSync(file,header+'\n40,-75,2026-01-20,1000,SNPP,n,2,1\n40,-75,2026-01-20,1000,SNPP,n,2,-1\n');
  let report=await inspectFile(file,'viirs_snpp');assert.equal(report.valid,1);assert.equal(report.rejected,1);assert.deepEqual(report.detection_bounds,[-75,40,-75,40]);
  await ingestFile(db,file,'viirs_snpp',()=>{});const sources=db.prepare('SELECT * FROM sources').all();
  report=await inspectFile(file,'viirs_snpp',sources);assert.equal(report.decision,'already_imported');
  const other=join(dir,'fire_archive_changed.csv');writeFileSync(other,header+'\n40,-75,2026-01-20,1000,SNPP,n,2,3\n');
  report=await inspectFile(other,'viirs_snpp',sources);assert.equal(report.decision,'blocked_overlap');assert.equal(report.overlaps.length,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sources').get().n,1);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('comparison aligns months and preserves unknowns, processing and area filters',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'firesense-comparison-')),db=openDb(join(dir,'test.sqlite'));
 try{
  for(const [name,product,rows]of [
   ['fire_archive_modis','modis','40,-75,2026-01-20,1000,Terra,80,6.1,4\n40,-75,2026-02-20,1000,Aqua,10,6.1,4'],
   ['fire_archive_viirs','viirs_snpp','40,-75,2026-02-20,1000,SNPP,n,2,4'],
   ['fire_nrt_viirs','viirs_snpp','40,-75,2026-01-20,1000,SNPP,n,2NRT,4']
  ]){const file=join(dir,name+'.csv');writeFileSync(file,header+'\n'+rows+'\n');await ingestFile(db,file,product,()=>{});}
  const filters=parseFilters(new URLSearchParams('confidence=nominal&start=2026-01-01&end=2026-02-28'));
  assert.deepEqual(queryComparison(db,filters).rows,[{month:'2026-01',modis:1,viirs_snpp:null},{month:'2026-02',modis:null,viirs_snpp:1}]);
  assert.equal(queryDashboard(db,{...filters,product:'modis'}).calendar.length,1);
  assert.deepEqual(queryComparison(db,{...filters,bbox:[0,0,10,10]}).rows,[]);
  assert.throws(()=>parseFilters(new URLSearchParams('bbox=,0,10,10')),/Empty/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
