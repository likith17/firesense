import {createReadStream,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openDb,ROOT} from './db.js';
import {csvRow,parseObservation} from './ingest.js';

export function canonicalRow(values,columns,product,processing){
 return JSON.stringify([product,processing,...columns.map((k,i)=>[k,values[i]]).sort((a,b)=>a[0].localeCompare(b[0]))]);
}
async function* records(source){
 const hash=createHash('sha256'),stream=createReadStream(resolve(ROOT,source.name));stream.on('data',c=>hash.update(c));
 const lines=createInterface({input:stream,crlfDelay:Infinity});let columns,header,previous='';
 for await(const line of lines){
  if(!columns){columns=csvRow(line.replace(/^\uFEFF/,''));header=Object.fromEntries(columns.map((k,i)=>[k,i]));continue;}
  if(!line.trim())continue;
  const values=csvRow(line);let r;
  try{r=parseObservation(values,header,source.product,source.processing);}catch{source.rejected++;continue;}
  if(r.date<previous)throw new Error('CSV is not date sorted: '+source.name);previous=r.date;source.accepted++;
  const identity=JSON.stringify([source.product,source.processing,r.satellite,r.date,values[header.acq_time].padStart(4,'0'),r.lat,r.lon]);
  yield {r,identity,key:canonicalRow(values,columns,source.product,source.processing)};
 }
 if(hash.digest('hex')!==source.sha256)throw new Error('Source changed after preflight: '+source.name);
}
export async function reconcile(reports,target,log=console.log){
 if(existsSync(target))throw new Error('Output already exists; choose a new output path');
 const unique=new Map(),aliases=[];
 for(const report of reports){if(unique.has(report.sha256)){aliases.push({name:report.name,same_as:unique.get(report.sha256).name});continue;}unique.set(report.sha256,{...report,accepted:0,rejected:0,duplicates:0,retained:0});}
 const sources=[...unique.values()],db=openDb(target);let total=0,days=0;
 try{
  db.exec('BEGIN IMMEDIATE');
  db.exec('CREATE TABLE reconciliation (source_id INTEGER PRIMARY KEY, accepted INTEGER, duplicates INTEGER, rejected INTEGER); CREATE TABLE build_metadata (key TEXT PRIMARY KEY,value TEXT);');
  for(const s of sources){s.id=Number(db.prepare("INSERT INTO sources(name,sha256,product,processing,imported_at) VALUES(?,?,?,?,?)").run(s.name,s.sha256,s.product,s.processing,new Date().toISOString()).lastInsertRowid);s.iterator=records(s);s.next=await s.iterator.next();}
  const insert=db.prepare('INSERT INTO daily VALUES(?,?,?,?,?,?,?,?)');
  while(sources.some(s=>!s.next.done)){
   const date=sources.filter(s=>!s.next.done).map(s=>s.next.value.r.date).sort()[0],seen=new Set(),identities=new Map(),aggregates=new Map();
   for(const s of sources){while(!s.next.done&&s.next.value.r.date===date){
    const {r,key,identity}=s.next.value;
    const prior=identities.get(identity);
    if(prior&&prior.source!==s.id&&!prior.keys.has(key))throw new Error('Conflicting overlapping observation; explicit revision policy required: '+s.name+' '+identity);
    if(prior)prior.keys.add(key);else identities.set(identity,{source:s.id,keys:new Set([key])});
    if(seen.has(key))s.duplicates++;else{seen.add(key);s.retained++;total++;
     const k=`${s.id}|${r.x}|${r.y}|${r.satellite}`,a=aggregates.get(k);
     if(a){a[5]++;a[6]+=r.frp;a[7]+=r.nominal;}else aggregates.set(k,[s.id,date,r.x,r.y,r.satellite,1,r.frp,r.nominal]);
    }
    s.next=await s.iterator.next();
   }}
   for(const a of aggregates.values())insert.run(...a);
   days++;if(days%365===0)log(`${date}: ${total.toLocaleString()} retained observations`);
  }
  for(const s of sources){
   if(s.accepted!==s.valid||s.rejected!==s.rejectedExpected)throw new Error('Preflight counts changed: '+s.name);
   db.prepare("UPDATE sources SET rows=?,rejected=?,min_date=?,max_date=?,west=?,south=?,east=?,north=?,satellites=?,versions=?,status='ready' WHERE id=?").run(s.retained,s.rejected,s.min_date,s.max_date,...s.detection_bounds,JSON.stringify(s.satellites),JSON.stringify(s.versions),s.id);
   db.prepare('INSERT INTO reconciliation VALUES(?,?,?,?)').run(s.id,s.accepted,s.duplicates,s.rejected);
  }
  const report={generated_at:new Date().toISOString(),total,aliases,sources:sources.map(({iterator,next,...s})=>s),policy:'Exact full-field rows deduplicated within product and processing. Differing revisions are not resolved or merged. Standard and NRT remain separate. Attribution goes to first source in preflight order.'};
  db.prepare('INSERT INTO build_metadata VALUES(?,?)').run('reconciliation',JSON.stringify(report));
  db.exec('COMMIT; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA optimize');return report;
 }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{for(const s of sources)await s.iterator?.return();db.close();}
}
async function main(){const input=JSON.parse(readFileSync(resolve(ROOT,'outputs/import-preflight.json')));const target=resolve(ROOT,process.argv[2]||'data/processed/firesense-reconciled.sqlite');const report=await reconcile(input.reports.map(s=>({...s,rejectedExpected:s.rejected})),target);writeFileSync(resolve(ROOT,'outputs/reconciliation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({target,total:report.total,duplicates:report.sources.reduce((n,s)=>n+s.duplicates,0)}));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1;});
