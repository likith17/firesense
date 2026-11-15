// Ad-hoc API verification probe (not part of the app). Run: node outputs/api-probe.mjs
const BASE='http://127.0.0.1:8000';
const cases=[
 ['GET /','/' ,200],
 ['app.js','/app.js',200],
 ['style.css','/style.css',200],
 ['unknown path','/nope',404],
 ['traversal','/../package.json',404],
 ['traversal encoded','/%2e%2e%2fpackage.json',404],
 ['status','/api/status',200],
 ['evaluation','/api/evaluation',200],
 ['provenance','/api/provenance.json',200],
 ['dashboard default','/api/dashboard',200],
 ['dashboard CA 2020','/api/dashboard?product=viirs_snpp&processing=standard&start=2020-01-01&end=2020-12-31&bbox=-125,32,-114,42',200],
 ['dashboard world 2026','/api/dashboard?product=modis&processing=standard&start=2026-01-01&end=2026-06-30',200],
 ['dashboard non-US history (Amazon 2019)','/api/dashboard?product=viirs_snpp&processing=standard&start=2019-01-01&end=2019-12-31&bbox=-75,-15,-45,5',200],
 ['dashboard noaa20 (not imported)','/api/dashboard?product=viirs_noaa20',200],
 ['dashboard nrt','/api/dashboard?product=viirs_snpp&processing=nrt',200],
 ['dashboard confidence nominal','/api/dashboard?confidence=nominal',200],
 ['invalid product','/api/dashboard?product=goes',400],
 ['invalid processing','/api/dashboard?processing=live',400],
 ['invalid confidence','/api/dashboard?confidence=high',400],
 ['invalid date format','/api/dashboard?start=2020-1-1',400],
 ['impossible date','/api/dashboard?start=2020-02-30',400],
 ['reversed dates','/api/dashboard?start=2021-01-01&end=2020-01-01',400],
 ['reversed bbox','/api/dashboard?bbox=10,10,-10,-10',400],
 ['bbox out of range','/api/dashboard?bbox=-200,-90,180,90',400],
 ['bbox not numbers','/api/dashboard?bbox=a,b,c,d',400],
 ['bbox empty part','/api/dashboard?bbox=1,,3,4',400],
 ['bbox 3 parts','/api/dashboard?bbox=1,2,3',400],
 ['bbox 5 parts','/api/dashboard?bbox=1,2,3,4,5',400],
 ['antimeridian bbox','/api/dashboard?bbox=170,-10,-170,10',400],
 ['zero-width bbox','/api/dashboard?bbox=10,10,10,20',400],
 ['csv export','/api/export.csv?product=viirs_snpp&processing=standard&start=2020-01-01&end=2020-12-31&bbox=-125,32,-114,42',200],
 ['comparison','/api/comparison?product=viirs_snpp&processing=standard&start=2020-01-01&end=2020-12-31&bbox=-125,32,-114,42',200],
 ['comparison empty','/api/comparison?start=2005-01-01&end=2005-12-31&bbox=0,40,10,50',200],
 ['POST rejected',['/','POST'],405],
];
let fail=0;
for(const [name,spec,expected] of cases){
 const [path,method]=Array.isArray(spec)?spec:[spec,'GET'];
 const r=await fetch(BASE+path,{method});
 const ok=r.status===expected;
 if(!ok)fail++;
 let extra='';
 try{if(r.headers.get('content-type')?.includes('json')){const j=await r.json();
   if(j.summary)extra=` detections=${j.summary.detections} months=${j.calendar.length} grid=${j.grid.length}`;
   if(j.error)extra=` error="${j.error}"`;
   if(j.rows!==undefined&&typeof j.rows==='number')extra=` rows=${j.rows}`;
 } else {const t=await r.text();extra=` bytes=${t.length}`;}}catch{}
 console.log(`${ok?'PASS':'FAIL'} [${r.status}] ${name}${extra}`);
}
console.log(fail?`${fail} FAILURES`:'ALL PASS');
