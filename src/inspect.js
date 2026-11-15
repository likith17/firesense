import {createReadStream, existsSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {ROOT, DB_PATH} from './db.js';
import {csvRow, parseObservation} from './ingest.js';

// Full-file preflight. Never writes to the database or raw inputs.
export async function inspectFile(path,product,sources=[]) {
  if(!['modis','viirs_snpp','viirs_noaa20','viirs_noaa21'].includes(product))throw new Error('Unsupported product');
  const name=relative(ROOT,path).replaceAll('\\','/');
  const processing=/fire_archive_/i.test(name)?'standard':/fire_nrt_/i.test(name)?'nrt':null;
  if(!processing)throw new Error('Filename must identify fire_archive_ or fire_nrt_');
  const hash=createHash('sha256');
  const stream=createReadStream(path);stream.on('data',chunk=>hash.update(chunk));
  const lines=createInterface({input:stream,crlfDelay:Infinity});
  let columns,header,valid=0,rejected=0,min=null,max=null,west=180,south=90,east=-180,north=-90;
  const errors={},satellites=new Set(),versions=new Set();
  for await(let line of lines){
    if(!header){
      columns=csvRow(line.replace(/^\uFEFF/,''));
      if(new Set(columns).size!==columns.length)throw new Error('Duplicate column names');
      header=Object.fromEntries(columns.map((key,i)=>[key,i]));
      for(const key of ['latitude','longitude','frp','acq_date','acq_time','satellite','confidence','version'])if(!(key in header))throw new Error('Missing column '+key);
      continue;
    }
    if(!line.trim())continue;
    let row;try{row=parseObservation(csvRow(line),header,product,processing);}catch(e){rejected++;errors[e.message]=(errors[e.message]||0)+1;continue;}
    valid++;min=min===null||row.date<min?row.date:min;max=max===null||row.date>max?row.date:max;
    west=Math.min(west,row.lon);east=Math.max(east,row.lon);south=Math.min(south,row.lat);north=Math.max(north,row.lat);
    satellites.add(row.satellite);versions.add(row.version);
  }
  if(!header)throw new Error('Empty CSV');
  const sha256=hash.digest('hex');
  const identical=sources.find(s=>s.sha256===sha256);
  const overlaps=valid?sources.filter(s=>s.sha256!==sha256&&s.product===product&&s.processing===processing&&s.min_date<=max&&s.max_date>=min&&s.west<=east&&s.east>=west&&s.south<=north&&s.north>=south).map(s=>({name:s.name,sha256:s.sha256})):[];
  return {name,sha256,product,processing,columns,valid,rejected,errors,min_date:min,max_date:max,
    detection_bounds:valid?[west,south,east,north]:null,satellites:[...satellites],versions:[...versions],
    decision:identical?'already_imported':!valid?'no_valid_rows':overlaps.length?'blocked_overlap':'candidate_requires_scope_review',overlaps,
    caveats:['Detection bounds are not the requested footprint or complete satellite coverage.','Overlap is a conservative extent check, not exact observation deduplication.','Review request metadata and rejected rows before importing.']};
}
async function main(){
  let db;const sources=[];
  try{if(existsSync(DB_PATH)){db=new DatabaseSync(DB_PATH,{readOnly:true});sources.push(...db.prepare("SELECT * FROM sources WHERE status='ready'").all());}}finally{db?.close();}
  const reports=[];
  if(process.argv.length>2){if(process.argv.length!==4)throw new Error('Usage: node src/inspect.js <product> <CSV path>');reports.push(await inspectFile(resolve(process.argv[3]),process.argv[2],sources));}
  else for(const product of ['modis','viirs_snpp','viirs_noaa20','viirs_noaa21']){
    const folder=resolve(ROOT,'data/raw',product);if(!existsSync(folder))continue;
    for(const name of readdirSync(folder).filter(n=>n.endsWith('.csv')).sort()){
      console.log('Inspecting '+product+'/'+name);reports.push(await inspectFile(resolve(folder,name),product,sources));
    }
  }
  mkdirSync(resolve(ROOT,'outputs'),{recursive:true});
  const output=resolve(ROOT,'outputs/import-preflight.json');writeFileSync(output,JSON.stringify({generated_at:new Date().toISOString(),reports},null,2));
  console.log(JSON.stringify(reports.map(({name,valid,rejected,decision})=>({name,valid,rejected,decision})),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1;});
