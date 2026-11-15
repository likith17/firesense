import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectFile} from '../src/inspect.js';
import {reconcile} from '../src/reconcile.js';
const header='latitude,longitude,acq_date,acq_time,satellite,confidence,version,frp\n';
test('reconciliation deduplicates overlapping rows, keeps additions, rejects revisions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'firesense-reconcile-'));
 try{
  const a=join(dir,'fire_archive_a.csv'),b=join(dir,'fire_archive_b.csv');
  const row='40,-75,2026-01-20,1000,SNPP,n,2,1\n';
  writeFileSync(a,header+row+row);writeFileSync(b,header+row+'41,-76,2026-01-21,1000,SNPP,n,2,2\n');
  const reports=await Promise.all([a,b].map(async p=>{const r=await inspectFile(p,'viirs_snpp');return {...r,rejectedExpected:r.rejected};}));
  const result=await reconcile(reports,join(dir,'good.sqlite'),()=>{});assert.equal(result.total,2);assert.equal(result.sources.reduce((n,s)=>n+s.duplicates,0),2);
  writeFileSync(b,header+row.replace(',2,1',',2,3'));const r=await inspectFile(b,'viirs_snpp');
  await assert.rejects(reconcile([reports[0],{...r,rejectedExpected:0}],join(dir,'bad.sqlite'),()=>{}),/Conflicting/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
