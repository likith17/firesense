import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {openDb,ROOT} from './db.js';
import {createHandler} from './server.js';
const db=openDb();try{
 const handler=createHandler(db),checks=[];
 function request(url){const r={status:200,headers:{},body:''};handler({url,method:'GET'},{setHeader:(k,v)=>r.headers[k]=v,writeHead:s=>r.status=s,end:b=>r.body=String(b)});assert.equal(r.status,200,url);return r;}
 const status=JSON.parse(request('/api/status').body);assert.equal(status.rows,28789421);assert.equal(status.reconciled,true);checks.push('Active reconciled database and source ledger');
 const params='product=viirs_snpp&processing=standard&start=2024-01-01&end=2025-12-31&bbox=-125,32,-114,42&confidence=nominal';
 const data=JSON.parse(request('/api/dashboard?'+params).body);assert.equal(data.calendar.length,24);assert.equal(data.grid.reduce((n,r)=>n+r.detections,0),data.summary.detections);
 const csv=request('/api/export.csv?'+params).body.trim().split('\n');assert.equal(csv.length,25);assert.equal(csv.slice(1).reduce((n,l)=>n+Number(l.split(',')[8]),0),data.summary.detections);checks.push('Real-data dashboard / grid / CSV reconciliation');
 const comparison=JSON.parse(request('/api/comparison?'+params).body);assert.equal(comparison.rows.length,24);assert.ok(comparison.rows.every(r=>r.modis>0&&r.viirs_snpp>0));checks.push('Matched raw sensor comparison');
 const evaluation=JSON.parse(request('/api/evaluation').body);assert.equal(evaluation.test.n,72);assert.equal(evaluation.splits.test,'2024-2025');checks.push('Held-out evaluation served');
 assert.equal(JSON.parse(request('/api/provenance.json').body).sources.length,9);checks.push('Provenance download');
 const html=readFileSync(resolve(ROOT,'dist/FireSense-demo.html'),'utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new Script(scripts[0][1]);assert.ok(!html.includes('src="/app.js"'));checks.push('Offline demo embeds assets and parses as JavaScript (not a visual test)');
 const report={generated_at:new Date().toISOString(),checks,visual_verification:false};writeFileSync(resolve(ROOT,'outputs/smoke-test.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{db.close();}
