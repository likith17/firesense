const PRODUCTS=['modis','viirs_snpp','viirs_noaa20','viirs_noaa21'];
export function parseFilters(params) {
  const product=params.get('product')||'viirs_snpp',processing=params.get('processing')||'standard';
  if(!PRODUCTS.includes(product)||!['standard','nrt'].includes(processing))throw new Error('Invalid product or processing');
  const start=params.get('start')||'2000-01-01',end=params.get('end')||'2099-12-31';
  for(const d of [start,end])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw new Error('Invalid date');
  if(start>end)throw new Error('Start date is after end date');
  const parts=(params.get('bbox')||'-180,-90,180,90').split(',');
  if(parts.some(x=>!x.trim()))throw new Error('Empty bounding box coordinate');
  const bbox=parts.map(Number);
  if(bbox.length!==4||bbox.some(x=>!Number.isFinite(x))||bbox[0]<-180||bbox[2]>180||bbox[1]<-90||bbox[3]>90||bbox[0]>=bbox[2]||bbox[1]>=bbox[3])throw new Error('Invalid bounding box; split antimeridian areas into two queries');
  const confidence=params.get('confidence')||'all';if(!['all','nominal'].includes(confidence))throw new Error('Invalid confidence');
  return {product,processing,start,end,bbox,confidence};
}
export function queryDashboard(db,f) {
  const [w,s,e,n]=f.bbox;
  const where=`FROM daily d JOIN sources s ON s.id=d.source_id WHERE s.status='ready' AND s.product=? AND s.processing=? AND d.date BETWEEN ? AND ? AND d.x+0.5>=? AND d.x+0.5<? AND d.y+0.5>=? AND d.y+0.5<?`;
  const args=[f.product,f.processing,f.start,f.end,w+180,e+180,s+90,n+90];
  const count=f.confidence==='nominal'?'d.nominal':'d.detections';
  const calendar=db.prepare(`SELECT substr(date,1,7) month,SUM(${count}) detections,COUNT(DISTINCT CASE WHEN ${count}>0 THEN date END) observed_days ${where} GROUP BY month HAVING SUM(${count})>0 ORDER BY month`).all(...args);
  const grid=db.prepare(`SELECT x-179.5 lon,y-89.5 lat,SUM(${count}) detections ${where} GROUP BY x,y HAVING SUM(${count})>0 ORDER BY detections DESC`).all(...args);
  const summary=db.prepare(`SELECT SUM(${count}) detections,MIN(CASE WHEN ${count}>0 THEN date END) first_date,MAX(CASE WHEN ${count}>0 THEN date END) last_date,COUNT(DISTINCT CASE WHEN ${count}>0 THEN date END) observed_days ${where}`).get(...args);
  const platforms=db.prepare(`SELECT satellite,SUM(${count}) detections ${where} GROUP BY satellite`).all(...args);
  const seasonal=Array.from({length:12},(_,i)=>({month:i+1,total:0,years:0}));
  for(const row of calendar){const cell=seasonal[Number(row.month.slice(5))-1];cell.total+=row.detections;cell.years++;}
  return {filters:f,summary,calendar,grid,platforms,seasonal,notes:['Grid cells are 1 degree, selected by cell center; bounds are approximate.','Missing months are unknown, not zero. Observed days count days with detections, not satellite coverage.','Counts describe hotspot detections, not unique fires or burned area.','Processing classes remain separate. Confidence thresholds differ by sensor.']};
}
export function queryComparison(db,filters) {
  // Identical requested dates, bounds and processing; no claim of equal observation opportunity.
  const products=['modis','viirs_snpp'];
  const series=products.map(product=>{
    const data=queryDashboard(db,{...filters,product});
    return {product,calendar:data.calendar,summary:data.summary,platforms:data.platforms};
  });
  const months=[...new Set(series.flatMap(s=>s.calendar.map(r=>r.month)))].sort();
  const rows=months.map(month=>Object.fromEntries([['month',month],...series.map(s=>[s.product,s.calendar.find(r=>r.month===month)?.detections??null])]));
  return {filters,series,rows,status:'raw_unadjusted',notes:[
    'Same requested area and dates do not establish matching satellite coverage.',
    'Null means no qualifying detections available, not verified zero activity.',
    'MODIS and VIIRS counts are not equivalent. No calibration or prediction is applied.'
  ]};
}
export function sourceStatus(db) {
  const sources=db.prepare("SELECT * FROM sources WHERE status='ready' ORDER BY product,processing").all();
  const reconciled=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reconciliation'").get();
  if(reconciled)for(const s of sources)Object.assign(s,db.prepare('SELECT accepted,duplicates FROM reconciliation WHERE source_id=?').get(s.id));
  return {sources,rows:sources.reduce((n,s)=>n+s.rows,0),rejected:sources.reduce((n,s)=>n+s.rejected,0),resolution_degrees:1,
    coverage:reconciled?{modis:'U.S. history from November 2000; global exports from January 2026. Earlier worldwide coverage is incomplete.',viirs_snpp:'U.S.-extent history from January 2012; global exports from January 2026. Request footprint needs confirmation.'}:{modis:'United States only (request 851088)',viirs_snpp:'World, partial 2026 (request 851089)'},
    reconciled,harmonization:{status:'experimental',reason:'See held-out regional evaluation. Raw sensor counts are not equivalent; global and pre-2012 transfer remain unvalidated.'}};
}
