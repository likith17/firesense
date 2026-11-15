import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDb} from '../src/db.js';
import {ingestFile,csvRow} from '../src/ingest.js';
import {parseFilters,queryDashboard} from '../src/queries.js';
const header='latitude,longitude,acq_date,acq_time,satellite,confidence,version,frp';
test('CSV quoting preserves commas and escaped quotes',()=>{assert.deepEqual(csvRow('a,"b,c","d""e"'),['a','b,c','d"e']);assert.throws(()=>csvRow('a,"b'));});
test('rejects invalid filters rather than expanding scope',()=>{for(const query of ['bbox=1,2,0,3','start=2026-02-30','product=evil','confidence=foo','start=2026-10-10&end=2026-01-01'])assert.throws(()=>parseFilters(new URLSearchParams(query)));});
test('global imports, processing isolation, idempotency and atomic overlap rejection',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'firesense-test-'));const db=openDb(join(dir,'test.sqlite'));
 try{
 const file=join(dir,'fire_archive_fixture.csv');
 writeFileSync(file,header+'\n-30,140,2026-01-20,0100,SNPP,n,2,12\n40,-75,2026-01-21,0200,SNPP,l,2,8\n91,0,2026-01-21,0200,SNPP,n,2,1\n');
 const first=await ingestFile(db,file,'viirs_snpp',()=>{});assert.equal(first.count,2);assert.equal(first.rejected,1);
 assert.equal((await ingestFile(db,file,'viirs_snpp',()=>{})).skipped,true);
 const nrt=join(dir,'fire_nrt_fixture.csv');writeFileSync(nrt,header+'\n-30,140,2026-01-20,0100,SNPP,n,2.0NRT,99\n');await ingestFile(db,nrt,'viirs_snpp',()=>{});
 let data=queryDashboard(db,parseFilters(new URLSearchParams()));assert.equal(data.summary.detections,2);assert.equal(data.grid.length,2);assert.equal(data.calendar.length,1);
 data=queryDashboard(db,parseFilters(new URLSearchParams('bbox=100,-50,160,-10')));assert.equal(data.summary.detections,1);
 data=queryDashboard(db,parseFilters(new URLSearchParams('confidence=nominal')));assert.equal(data.summary.detections,1);
 data=queryDashboard(db,parseFilters(new URLSearchParams('processing=nrt')));assert.equal(data.summary.detections,1);
 const overlap=join(dir,'fire_archive_overlap.csv');writeFileSync(overlap,header+'\n-30,140,2026-01-20,0100,SNPP,n,2,13\n');await assert.rejects(ingestFile(db,overlap,'viirs_snpp',()=>{}),/Overlapping/);
 assert.equal(db.prepare('SELECT count(*) n FROM sources').get().n,2);
 const bad=join(dir,'fire_archive_bad.csv');writeFileSync(bad,'wrong,header\n1,2');await assert.rejects(ingestFile(db,bad,'viirs_snpp',()=>{}),/Missing column/);
 assert.equal(db.prepare('SELECT count(*) n FROM sources').get().n,2);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
