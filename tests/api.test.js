import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDb} from '../src/db.js';
import {createHandler} from '../src/server.js';
test('HTTP handler serves UI, JSON, CSV and rejects invalid requests',()=>{
 const dir=mkdtempSync(join(tmpdir(),'firesense-api-')),db=openDb(join(dir,'test.sqlite'));
 try {
  const handler=createHandler(db);
  function request(url,method='GET'){const result={status:200,headers:{},body:''};handler({url,method},{setHeader:(k,v)=>result.headers[k]=v,writeHead:s=>result.status=s,end:b=>result.body=String(b)});return result;}
  const html=request('/');assert.equal(html.status,200);assert.match(html.body,/FireSense/);assert.match(html.headers['Content-Security-Policy'],/frame-ancestors 'none'/);
  assert.equal(JSON.parse(request('/api/status').body).rows,0);
  const empty=JSON.parse(request('/api/dashboard').body);assert.equal(empty.summary.detections,null);assert.deepEqual(empty.calendar,[]);
  assert.equal(request('/api/dashboard?bbox=0,0,0,0').status,400);
  assert.equal(request('/api/status','POST').status,405);
  assert.equal(request('/unknown').status,404);
  const csv=request('/api/export.csv');assert.match(csv.headers['Content-Type'],/text\/csv/);assert.match(csv.body,/month,product,processing/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('real HTTP server returns 400 for invalid parameters and keeps serving',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'firesense-http-')),db=openDb(join(dir,'test.sqlite'));
 const {createServer}=await import('node:http');
 const server=createServer(createHandler(db));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try {
  // Regression: writeHead+setHeader ordering previously crashed the whole process on any invalid parameter.
  for(const bad of ['/api/dashboard?product=goes','/api/dashboard?start=2020-02-30','/api/comparison?bbox=1,2,3','/api/export.csv?confidence=high']){
    const r=await fetch(base+bad);
    assert.equal(r.status,400,bad);
    assert.ok((await r.json()).error,bad);
  }
  const alive=await fetch(base+'/api/status');
  assert.equal(alive.status,200);
  assert.equal((await alive.json()).rows,0);
 }finally{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
