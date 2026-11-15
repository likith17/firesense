import { createServer } from 'node:http';
import { readFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDb, ROOT } from './db.js';
import { parseFilters,queryDashboard,sourceStatus,queryComparison } from './queries.js';
const files={'/':['web/index.html','text/html'],'/app.js':['web/app.js','text/javascript'],'/style.css':['web/style.css','text/css']};
export function createHandler(db) {
const cache=new Map();
return (req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
  if(req.method!=='GET'){res.writeHead(405);return res.end('GET only');}
  const url=new URL(req.url,'http://localhost');
  try {
    if(url.pathname==='/api/status')return json(res,sourceStatus(db));
    if(url.pathname==='/api/evaluation'){
      const path=resolve(ROOT,'outputs/evaluation.json');
      if(!existsSync(path))return json(res,{error:'Evaluation has not been generated.'},404);
      return json(res,JSON.parse(readFileSync(path,'utf8')));
    }
    if(url.pathname==='/api/provenance.json'){
      res.setHeader('Content-Disposition','attachment; filename="firesense-provenance.json"');
      return json(res,{generated_at:new Date().toISOString(),...sourceStatus(db)});
    }
    if(url.pathname==='/api/comparison')return json(res,queryComparison(db,parseFilters(url.searchParams)));
    if(['/api/dashboard','/api/export.csv'].includes(url.pathname)) {
      const f=parseFilters(url.searchParams),key=JSON.stringify(f);
      let entry=cache.get(key);if(!entry||Date.now()-entry.time>60000){entry={time:Date.now(),data:queryDashboard(db,f)};if(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(key,entry);}
      if(url.pathname.endsWith('.csv')){res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="firesense-calendar.csv"');return res.end('month,product,processing,confidence,west,south,east,north,detections,days_with_detections\n'+entry.data.calendar.map(r=>[r.month,f.product,f.processing,f.confidence,...f.bbox,r.detections,r.observed_days].join(',')).join('\n'));}
      return json(res,entry.data);
    }
    if(files[url.pathname]){const [path,type]=files[url.pathname];res.setHeader('Content-Type',type+'; charset=utf-8');return res.end(readFileSync(resolve(ROOT,path)));}
    res.writeHead(404);res.end('Not found');
  }catch(e){
    if(res.headersSent)return res.destroy();
    if(url.pathname.startsWith('/api/'))return json(res,{error:e.message},400);
    res.writeHead(500);res.end('Unable to serve page');
  }
};
}
function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
const db=openDb(),server=createServer(createHandler(db));
server.listen(Number(process.env.PORT)||8000,process.env.HOST||'127.0.0.1',()=>console.log('FireSense listening on '+(process.env.HOST||'127.0.0.1')+':'+(Number(process.env.PORT)||8000)));
process.on('SIGINT',()=>server.close(()=>{db.close();process.exit(0);}));
}
