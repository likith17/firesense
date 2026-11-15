// Performance probe against the running server (ad-hoc verification).
import {spawn} from 'node:child_process';
const BASE='http://127.0.0.1:8000';
const time=async(path)=>{const t=performance.now();const r=await fetch(BASE+path);await r.arrayBuffer();return Math.round(performance.now()-t);};
// Cold start: spawn a second instance on another port and time until it responds.
const t0=performance.now();
const child=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'8010'},stdio:'ignore'});
let cold=null;
for(let i=0;i<200;i++){try{const r=await fetch('http://127.0.0.1:8010/api/status');if(r.ok){cold=Math.round(performance.now()-t0);break;}}catch{}await new Promise(r=>setTimeout(r,25));}
child.kill();
const out={cold_start_ms:cold};
// Representative latencies (second call hits the 60s cache).
out.small_CA_year_ms=[await time('/api/dashboard?product=viirs_snpp&processing=standard&start=2020-01-01&end=2020-12-31&bbox=-125,32,-114,42'),await time('/api/dashboard?product=viirs_snpp&processing=standard&start=2020-01-01&end=2020-12-31&bbox=-125,32,-114,42')];
out.world_2026_ms=await time('/api/dashboard?product=viirs_snpp&processing=standard&start=2026-01-01&end=2026-07-31&bbox=-179,-89,179,89');
out.full_history_world_ms=await time('/api/dashboard?product=viirs_snpp&processing=standard&start=2012-01-01&end=2026-12-31&bbox=-179.5,-89,179,89');
out.comparison_CA_13y_ms=await time('/api/comparison?product=viirs_snpp&processing=standard&start=2013-01-01&end=2025-12-31&bbox=-125,32,-114,42');
// Concurrency: 8 distinct uncached heavy-ish queries at once (synchronous SQLite => serialized).
const qs=Array.from({length:8},(_,i)=>`/api/dashboard?product=modis&processing=standard&start=201${i%8}-01-01&end=201${i%8}-12-31&bbox=-126,2${i%4},-66,50`);
const tc=performance.now();
const results=await Promise.all(qs.map(q=>time(q)));
out.concurrent_8={wall_ms:Math.round(performance.now()-tc),each_ms:results};
// While a heavy query runs, how long does a tiny request wait?
const heavy=time('/api/dashboard?product=modis&processing=standard&start=2000-01-01&end=2026-12-31&bbox=-178,-88,178,88');
await new Promise(r=>setTimeout(r,30));
out.tiny_during_heavy_ms=await time('/api/status');
out.heavy_ms=await heavy;
console.log(JSON.stringify(out,null,1));
