import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDb,ROOT} from './db.js';
import {sourceStatus,parseFilters,queryDashboard,queryComparison} from './queries.js';
const db=openDb();
try{
 const presets=[['world','-180,-90,180,90','2026-01-01','2026-07-31'],['california','-125,32,-114,42','2013-01-01','2025-12-31'],['northwest','-125,42,-116,49','2013-01-01','2025-12-31'],['southeast','-90,25,-75,36','2013-01-01','2025-12-31']];
 const snapshots=presets.map(([name,bbox,start,end])=>{const filters=parseFilters(new URLSearchParams({product:'viirs_snpp',processing:'standard',confidence:'all',bbox,start,end}));return {name,dashboard:queryDashboard(db,filters),comparison:queryComparison(db,filters)};});
 const bundle={generated_at:new Date().toISOString(),catalog:sourceStatus(db),evaluation:JSON.parse(readFileSync(resolve(ROOT,'outputs/evaluation.json'),'utf8')),snapshots};
 const safe=JSON.stringify(bundle).replaceAll('<','\\u003c');
 const bootstrap=`const OFFLINE=${safe};
window.fetch=async function(url){const u=new URL(url,'http://offline.local');let data;
if(u.pathname==='/api/status')data=OFFLINE.catalog;
else if(u.pathname==='/api/evaluation')data=OFFLINE.evaluation;
else {const found=OFFLINE.snapshots.find(s=>['start','end','product','processing','confidence'].every(k=>s.dashboard.filters[k]===u.searchParams.get(k))&&s.dashboard.filters.bbox.join(',')===u.searchParams.get('bbox'));if(found)data=u.pathname==='/api/comparison'?found.comparison:found.dashboard;}
return {ok:!!data,json:async()=>data||{error:'This offline demo supports the four preset selections. Run the server for arbitrary queries.'}};};
function saveFile(name,text,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.getElementById('export').addEventListener('click',e=>{e.preventDefault();if(!current)return;saveFile('firesense-calendar.csv','month,detections,days_with_detections\\n'+current.calendar.map(r=>[r.month,r.detections,r.observed_days].join(',')).join('\\n'),'text/csv');});
document.querySelector('[href="/api/provenance.json"]').addEventListener('click',e=>{e.preventDefault();saveFile('firesense-provenance.json',JSON.stringify(OFFLINE.catalog,null,2),'application/json');});`;
 let html=readFileSync(resolve(ROOT,'web/index.html'),'utf8').replace('<link rel="stylesheet" href="/style.css">','<style>'+readFileSync(resolve(ROOT,'web/style.css'),'utf8')+'#filters{display:none}#map{pointer-events:none}.offline-banner{padding:14px;border:1px solid #c5e4a5;border-radius:8px;color:#c5e4a5;margin-top:20px}</style>');
 html=html.replace('<main>','<main><p class="offline-banner">OFFLINE REAL-DATA DEMO - four fixed selections. Use the preset buttons to explore. Arbitrary filters and drag selection require the full local app. Snapshot: '+bundle.generated_at+'.</p>');
 html=html.replace('<script src="/app.js" defer></script>','<script>'+bootstrap+'\n'+readFileSync(resolve(ROOT,'web/app.js'),'utf8')+'</script>');
 html=html.replace('Choose a region or drag a box on the atlas.','Choose one of the four demo presets above.');
 html=html.replace('<a class="brand" href="/">','<a class="brand" href="#">'); // keep the offline file self-contained; "/" would leave the page
 mkdirSync(resolve(ROOT,'dist'),{recursive:true});writeFileSync(resolve(ROOT,'dist/FireSense-demo.html'),html);
 writeFileSync(resolve(ROOT,'outputs/demo-snapshots.json'),JSON.stringify(bundle,null,2));
 console.log(JSON.stringify({file:'dist/FireSense-demo.html',bytes:Buffer.byteLength(html),presets:snapshots.map(s=>({name:s.name,detections:s.dashboard.summary.detections,months:s.dashboard.calendar.length}))},null,2));
}finally{db.close();}
