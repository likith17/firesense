import { createReadStream, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { openDb, ROOT } from './db.js';

export function csvRow(line) {
  if (!line.includes('"')) return line.split(',');
  const fields=[]; let value='', quoted=false;
  for(let i=0;i<line.length;i++) {
    const c=line[i];
    if(c==='"') { if(quoted && line[i+1]==='"') {value+='"';i++;} else quoted=!quoted; }
    else if(c===',' && !quoted) {fields.push(value);value='';} else value+=c;
  }
  if(quoted) throw new Error('Multiline/unterminated CSV field is unsupported');
  return [...fields,value];
}
export function parseObservation(values, header, product, processing) {
  const get=k=>values[header[k]];
  if(values.length!==Object.keys(header).length) throw new Error('Field count');
  const lat=Number(get('latitude')),lon=Number(get('longitude')),frp=Number(get('frp'));
  if(!get('latitude') || !get('longitude') || !get('frp') || !Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(frp)||lat < -90||lat > 90||lon < -180||lon > 180||frp<0) throw new Error('Coordinates or FRP');
  const date=get('acq_date'),time=get('acq_time');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new Error('Date');
  if(!/^\d{1,4}$/.test(time)||Number(time)>2359||Number(time)%100>59) throw new Error('Time');
  const version=get('version'), isNrt=/NRT/i.test(version);
  if(isNrt!==(processing==='nrt')) throw new Error('Processing label disagrees with version');
  const satellite=get('satellite'),confidence=get('confidence');
  const allowed=product==='modis'?['Terra','Aqua']:product==='viirs_snpp'?['SNPP','N']:product==='viirs_noaa20'?['NOAA-20','1']:['NOAA-21','2'];
  if(!allowed.includes(satellite)) throw new Error('Satellite disagrees with product');
  let nominal;
  if(product==='modis') {if(!confidence || !Number.isFinite(Number(confidence)) || Number(confidence)<0 || Number(confidence)>100) throw new Error('Confidence'); nominal=Number(confidence)>=30;}
  else {if(!['l','n','h'].includes(confidence)) throw new Error('Confidence');nominal=confidence!=='l';}
  return {date,lat,lon,frp,satellite,version,nominal:Number(nominal),x:Math.min(359,Math.floor(lon+180)),y:Math.min(179,Math.floor(lat+90))};
}
async function fingerprint(path) { const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex'); }
export async function ingestFile(db,path,product,log=console.log) {
  if(!['modis','viirs_snpp','viirs_noaa20','viirs_noaa21'].includes(product))throw new Error('Unsupported product folder');
  const name=relative(ROOT,path).replaceAll('\\','/');
  const processing=/fire_archive_/i.test(name)?'standard':/fire_nrt_/i.test(name)?'nrt':null;
  if(!processing)throw new Error('Filename must identify fire_archive_ or fire_nrt_');
  const sha=await fingerprint(path);
  if(db.prepare('SELECT id FROM sources WHERE sha256=?').get(sha)){log(`Already imported: ${name}`);return {skipped:true};}
  let count=0,rejected=0,min='9999',max='',west=180,east=-180,south=90,north=-90;
  const satellites=new Set(),versions=new Set(), errors={}, buffer=new Map();
  db.exec('BEGIN IMMEDIATE');
  try {
    const id=Number(db.prepare('INSERT INTO sources(name,sha256,product,processing,imported_at) VALUES(?,?,?,?,?)').run(name,sha,product,processing,new Date().toISOString()).lastInsertRowid);
    const insert=db.prepare(`INSERT INTO daily VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(source_id,date,x,y,satellite) DO UPDATE SET detections=detections+excluded.detections, frp=frp+excluded.frp, nominal=nominal+excluded.nominal`);
    const flush=()=>{for(const row of buffer.values())insert.run(id,...row);buffer.clear();};
    const lines=createInterface({input:createReadStream(path),crlfDelay:Infinity});let header;
    for await(let line of lines) {
      if(!header) {line=line.replace(/^\uFEFF/,'');const keys=csvRow(line);header=Object.fromEntries(keys.map((k,i)=>[k,i]));for(const key of ['latitude','longitude','frp','acq_date','acq_time','satellite','confidence','version'])if(!(key in header))throw new Error(`Missing column ${key}`);continue;}
      if(!line.trim())continue;
      let r;try {r=parseObservation(csvRow(line),header,product,processing);}catch(e){rejected++;errors[e.message]=(errors[e.message]||0)+1;continue;}
      count++;min=min<r.date?min:r.date;max=max>r.date?max:r.date;
      west=Math.min(west,r.lon);east=Math.max(east,r.lon);south=Math.min(south,r.lat);north=Math.max(north,r.lat);satellites.add(r.satellite);versions.add(r.version);
      const key=`${r.date}|${r.x}|${r.y}|${r.satellite}`;
      const existing=buffer.get(key);
      if(existing){existing[4]++;existing[5]+=r.frp;existing[6]+=r.nominal;}
      else buffer.set(key,[r.date,r.x,r.y,r.satellite,1,r.frp,r.nominal]);
      if(buffer.size>=30000)flush();
      if(count%1000000===0)log(`${product}/${processing}: ${count.toLocaleString()} records`);
    }
    if(!count)throw new Error(`No valid records: ${JSON.stringify(errors)}`);
    // Reject overlapping exports rather than silently double-counting them.
    const overlap=db.prepare(`SELECT name FROM sources WHERE id<>? AND product=? AND processing=? AND status='ready' AND min_date<=? AND max_date>=? AND west<=? AND east>=? AND south<=? AND north>=?`).get(id,product,processing,max,min,east,west,north,south);
    if(overlap)throw new Error(`Overlapping export already loaded: ${overlap.name}. Reconciliation is required before importing this file.`);
    flush();
    db.prepare(`UPDATE sources SET rows=?,rejected=?,min_date=?,max_date=?,west=?,south=?,east=?,north=?,satellites=?,versions=?,status='ready' WHERE id=?`).run(count,rejected,min,max,west,south,east,north,JSON.stringify([...satellites]),JSON.stringify([...versions]),id);
    db.exec('COMMIT');log(JSON.stringify({name,count,rejected,errors,min,max,west,south,east,north}));
    return {count,rejected,min,max};
  } catch(e){db.exec('ROLLBACK');throw e;}
}
async function main(){const db=openDb();try{const base=resolve(ROOT,'data/raw');for(const product of readdirSync(base)){const folder=resolve(base,product);if(!statSync(folder).isDirectory())continue;for(const file of readdirSync(folder).filter(x=>x.endsWith('.csv')).sort())await ingestFile(db,resolve(folder,file),product);}db.exec('PRAGMA optimize');}finally{db.close();}}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1;});
