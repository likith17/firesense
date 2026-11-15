const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const fmt=n=>Number(n||0).toLocaleString(),compact=n=>Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let catalog,current,requestId=0;
function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function svg(tag,attrs,parent=$('map')){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
async function get(url){const r=await fetch(url);const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;}
function renderMap(data){const map=$('map');map.replaceChildren();
  for(let lon=-180;lon<=180;lon+=30)svg('line',{x1:(lon+180)/360*1000,x2:(lon+180)/360*1000,y1:0,y2:500,stroke:'#263b2e','stroke-width':.6});
  for(let lat=-60;lat<=60;lat+=30){const y=(90-lat)/180*500;svg('line',{x1:0,x2:1000,y1:y,y2:y,stroke:'#263b2e','stroke-width':.6});svg('text',{x:8,y:y-5}).textContent=lat+'°';}
  const max=Math.max(1,...data.grid.map(x=>x.detections));
  for(const c of data.grid){const t=Math.log1p(c.detections)/Math.log1p(max);const rect=svg('rect',{x:(c.lon+179.5)/360*1000,y:(90-c.lat-.5)/180*500,width:1000/360,height:500/180,fill:`rgb(${Math.round(100+155*t)},${Math.round(72+125*t)},${Math.round(42+90*t)})`,class:'cell'});svg('title',{},rect).textContent=`${c.lat.toFixed(1)}°, ${c.lon.toFixed(1)}°: ${fmt(c.detections)} detections`;}
  const [w,s,e,n]=data.filters.bbox;if(e-w<360||n-s<180)svg('rect',{x:(w+180)/360*1000,y:(90-n)/180*500,width:(e-w)/360*1000,height:(n-s)/180*500,fill:'none',stroke:'#c5e4a5','stroke-width':1.5,'vector-effect':'non-scaling-stroke'});
  if(!data.grid.length)svg('text',{x:500,y:250,'text-anchor':'middle'}).textContent='No observations available for this selection';
  $('cells').textContent=fmt(data.grid.length)+' occupied cells';
}
let calView='counts';
function median(values){const s=[...values].sort((a,b)=>a-b),mid=Math.floor(s.length/2);return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;}
function renderCalendar(data){const container=$('heatmap');container.replaceChildren();const top=element('div',undefined,'heat-row');for(const text of ['YEAR',...months])top.append(element('span',text));container.append(top);
  const note=$('calendar-note');
  const countsNote='Darker orange means more detections within this view. A "-" cell means no available detections; it does not establish zero fire activity or complete satellite coverage.';
  const anomalyNote='Orange = above, blue = below the median of the same calendar month across the other selected years; the MEDIAN row shows the median of all selected years per month. Descriptive within this selection only, not a normalized rate, risk score, or coverage-corrected anomaly. A "-" cell means no available detections; "·" means no other year to compare against.';
  if(note)note.textContent=calView==='anomaly'?anomalyNote:countsNote;
  if(!data.calendar.length){container.append(element('p','No observations for this selection. Check the source ledger and date range.','empty'));return;}
  const lookup=new Map(data.calendar.map(x=>[x.month,x])),max=Math.max(...data.calendar.map(x=>x.detections),1);
  const byMonth={};for(const r of data.calendar)(byMonth[r.month.slice(5)]??={})[r.month.slice(0,4)]=r.detections;
  const anomalies=new Map();let maxAbs=1;
  if(calView==='anomaly')for(const r of data.calendar){const others=Object.entries(byMonth[r.month.slice(5)]).filter(([y])=>y!==r.month.slice(0,4)).map(([,v])=>v);if(others.length){const med=median(others),delta=r.detections-med;anomalies.set(r.month,{delta,med,n:others.length});maxAbs=Math.max(maxAbs,Math.abs(delta));}}
  const first=Number(data.filters.start.slice(0,4)),last=Number(data.filters.end.slice(0,4));
  for(let year=last;year>=first;year--){const row=element('div',undefined,'heat-row');row.append(element('span',year));for(let m=1;m<=12;m++){const key=`${year}-${String(m).padStart(2,'0')}`,record=lookup.get(key);let cell;
    if(calView==='anomaly'){const a=anomalies.get(key);
      if(record&&a){const d=a.delta;cell=element('span',(d>0?'+':d<0?'−':'')+compact(Math.abs(d)),'heat');cell.dataset.an=d===0?'z':(d>0?'p':'n')+Math.max(1,Math.ceil(Math.log1p(Math.abs(d))/Math.log1p(maxAbs)*3));cell.title=`${key}: ${fmt(record.detections)} detections; median of the same month across ${a.n} other selected year${a.n>1?'s':''}: ${fmt(a.med)}; difference ${d>0?'+':''}${fmt(d)}. Descriptive within this selection; not coverage-corrected.`;}
      else if(record){cell=element('span','·','heat');cell.title=key+': '+fmt(record.detections)+' detections, but no other selected year has data for this month, so no typical value exists.';}
      else{cell=element('span','-','heat');cell.title=key+': outside selected dates or no qualifying detections; not a verified zero';}
    }else{cell=element('span',record?compact(record.detections):'-','heat');
      if(record){cell.dataset.level=Math.max(1,Math.ceil(Math.log1p(record.detections)/Math.log1p(max)*5));cell.title=`${key}: ${fmt(record.detections)} detections across ${record.observed_days} days with detections`;}
      else cell.title=key+': outside selected dates or no qualifying detections; not a verified zero';}
    row.append(cell);}container.append(row);}
  if(calView==='anomaly'){const row=element('div',undefined,'heat-row');row.append(element('span','MEDIAN'));
    for(let m=1;m<=12;m++){const values=Object.values(byMonth[String(m).padStart(2,'0')]||{});let cell;
      if(values.length){const med=median(values);cell=element('span',compact(med),'heat median');cell.title=months[m-1]+': median monthly detections across the '+values.length+' selected year'+(values.length>1?'s':'')+' with data: '+fmt(med)+'. Year cells above compare each year with the median of the other years only.';}
      else{cell=element('span','-','heat median');cell.title=months[m-1]+': no selected year has data for this month.';}
      row.append(cell);}
    container.append(row);}
}
for(const [id,mode] of [['cal-counts','counts'],['cal-anomaly','anomaly']])document.getElementById(id).addEventListener('click',()=>{calView=mode;for(const [bid,bmode] of [['cal-counts','counts'],['cal-anomaly','anomaly']]){$(bid).classList.toggle('active',bmode===mode);$(bid).setAttribute('aria-pressed',String(bmode===mode));}if(current)renderCalendar(current);});
function renderSeasonal(data){$('seasonal').replaceChildren();const max=Math.max(...data.seasonal.map(x=>x.total),1);for(const month of data.seasonal){const col=element('div',undefined,'season-column'),bar=element('div',undefined,'season-bar');bar.style.height=(month.total/max*140)+'px';col.title=`${months[month.month-1]}: ${fmt(month.total)} detections across ${month.years} represented years`;col.append(bar,element('span',months[month.month-1]));$('seasonal').append(col);}}
async function refresh(){const id=++requestId;$('apply').disabled=true;document.body.classList.add('busy');$('message').textContent='Querying local observations…';const params=new URLSearchParams(new FormData($('filters')));try{const data=await get('/api/dashboard?'+params);if(id!==requestId)return;current=data;renderMap(data);renderCalendar(data);renderSeasonal(data);$('count').textContent=data.summary.detections?fmt(data.summary.detections):'Unavailable';$('selection-summary').textContent=`${data.filters.product.toUpperCase()} | ${data.filters.processing} | ${data.filters.start} to ${data.filters.end} | Bounds: ${data.filters.bbox.join(', ')}`;$('comparison').replaceChildren();$('comparison-note').textContent='Uses this applied selection. Counts are raw and unadjusted.';$('days').textContent=fmt(data.summary.observed_days);$('latest').textContent=data.summary.last_date||'Unavailable';$('mode').textContent=data.filters.processing==='nrt'?'PROVISIONAL / NRT':'STANDARD ARCHIVE';$('scope').textContent=catalog.coverage[data.filters.product]||'This product has not been imported yet.';$('export').href='/api/export.csv?'+params;$('message').textContent=data.grid.length?'Showing observed hotspots. Missing records do not establish absence of fire. Global history before 2026 is incomplete.':'No records match this selection. Try another product, processing class, area, or date range.';}catch(e){$('message').textContent=e.message;}finally{if(id===requestId){$('apply').disabled=false;document.body.classList.remove('busy');}}}
$('filters').addEventListener('submit',e=>{e.preventDefault();markPreset('');refresh();});
$('region').addEventListener('change',()=>{markPreset('');if($('region').value!=='custom')$('bbox').value=$('region').value;});
$('bbox').addEventListener('input',()=>{$('region').value='custom';markPreset('');});
function setDates(){const sources=catalog.sources.filter(s=>s.product===$('product').value&&s.processing===$('processing').value);if(sources.length){$('start').value=sources.map(s=>s.min_date).sort()[0];$('end').value=sources.map(s=>s.max_date).sort().at(-1);}}
$('product').addEventListener('change',()=>{setDates();markPreset('');});$('processing').addEventListener('change',()=>{setDates();markPreset('');});
let drag,selection;
function coords(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('map').getScreenCTM().inverse());return [Math.max(0,Math.min(1000,p.x)),Math.max(0,Math.min(500,p.y))];}
$('map').addEventListener('pointerdown',e=>{drag=coords(e);$('map').setPointerCapture(e.pointerId);selection=svg('rect',{x:drag[0],y:drag[1],width:0,height:0,fill:'#c5e4a5','fill-opacity':.12,stroke:'#c5e4a5'});});
$('map').addEventListener('pointermove',e=>{if(!drag)return;const [x,y]=coords(e);selection.setAttribute('x',Math.min(x,drag[0]));selection.setAttribute('y',Math.min(y,drag[1]));selection.setAttribute('width',Math.abs(x-drag[0]));selection.setAttribute('height',Math.abs(y-drag[1]));});
$('map').addEventListener('pointerup',e=>{if(!drag)return;const [x,y]=coords(e),[x0,y0]=drag;drag=null;selection.remove();if(Math.abs(x-x0)<4||Math.abs(y-y0)<4)return;const bbox=[Math.min(x,x0)/1000*360-180,90-Math.max(y,y0)/500*180,Math.max(x,x0)/1000*360-180,90-Math.min(y,y0)/500*180];$('bbox').value=bbox.map(n=>n.toFixed(2)).join(',');$('region').value='custom';markPreset('');refresh();});
$('map').addEventListener('pointercancel',()=>{drag=null;selection?.remove();});
async function init(){try{catalog=await get('/api/status');$('loaded').textContent=fmt(catalog.rows)+' observations · '+catalog.sources.length+' source files';for(const s of catalog.sources){const row=element('tr'),name=element('td',s.product.toUpperCase().replaceAll('_',' '));name.append(element('small',s.name.split('/').at(-1)));row.append(name,element('td',s.processing==='nrt'?'NRT / provisional':'Standard'),element('td',s.min_date+' → '+s.max_date),element('td',fmt(s.rows)),element('td',fmt(s.rejected)),element('td',s.duplicates===undefined?'Legacy':fmt(s.duplicates)),element('td',(JSON.parse(s.satellites||'[]').join(', '))+' / '+JSON.parse(s.versions||'[]').join(', ')));$('sources').append(row);}setDates();if(catalog.reconciled)$('start').value='2026-01-01';markPreset('world');await refresh();loadEvaluation();}catch(e){$('message').textContent='Unable to load local data: '+e.message;}}
$('compare').addEventListener('click',async()=>{
 if(!current)return;
 const view=current,id=requestId;
 const p=new URLSearchParams({...view.filters,bbox:view.filters.bbox.join(',')});
 $('compare').disabled=true;$('comparison-note').textContent='Loading matching selections...';
 try{
  const data=await get('/api/comparison?'+p);if(id!==requestId)return;
  const table=element('table'),head=element('thead'),tr=element('tr');
  for(const title of ['Month','MODIS','VIIRS S-NPP'])tr.append(element('th',title));head.append(tr);table.append(head);
  const body=element('tbody');
  const maxV=Math.max(1,...data.rows.flatMap(r=>[r.modis,r.viirs_snpp]).filter(v=>v!==null));
  for(const r of data.rows){const row=element('tr');row.append(element('td',r.month));
   for(const [field,cls] of [['modis','modis'],['viirs_snpp','viirs']]){const td=element('td'),v=r[field];
    if(v===null)td.append(element('span','Unavailable','muted'));
    else{const wrap=element('div',undefined,'bar-cell'),bar=document.createElement('i');bar.className=cls;bar.style.width=Math.max(1,v/maxV*55)+'%';wrap.append(bar,element('span',fmt(v)));td.append(wrap);}
    row.append(td);}
   body.append(row);}
  table.append(body);$('comparison').replaceChildren(table);
  $('comparison-note').textContent=data.rows.length?'Raw counts in the same requested bounds and dates. Satellite coverage and detection sensitivity differ; unavailable is not zero.':'No qualifying detections for either sensor in this selection.';
 }catch(e){if(id===requestId)$('comparison-note').textContent=e.message;}finally{$('compare').disabled=false;}
});
init();

function zoom(factor){const v=$('map').viewBox.baseVal;const width=Math.min(1000,Math.max(30,v.width*factor)),height=width/2;const x=Math.max(0,Math.min(1000-width,v.x+v.width/2-width/2)),y=Math.max(0,Math.min(500-height,v.y+v.height/2-height/2));$('map').setAttribute('viewBox',[x,y,width,height].join(' '));}
$('zoom-in').onclick=()=>zoom(.5);$('zoom-out').onclick=()=>zoom(2);$('zoom-reset').onclick=()=>$('map').setAttribute('viewBox','0 0 1000 500');
$('zoom-selection').onclick=()=>{if(!current)return;const [w,s,e,n]=current.filters.bbox;const width=Math.min(1000,Math.max((e-w)/360*1000,(n-s)/180*1000,30)*1.1),height=width/2;const x=Math.max(0,Math.min(1000-width,(w+e+360)/720*1000-width/2)),y=Math.max(0,Math.min(500-height,(180-n-s)/360*500-height/2));$('map').setAttribute('viewBox',[x,y,width,height].join(' '));};
const cases={world:['-180,-90,180,90','2026-01-01','2026-07-31'],california:['-125,32,-114,42','2013-01-01','2025-12-31'],northwest:['-125,42,-116,49','2013-01-01','2025-12-31'],southeast:['-90,25,-75,36','2013-01-01','2025-12-31']};
function markPreset(name){for(const b of document.querySelectorAll('[data-case]'))b.setAttribute('aria-pressed',String(b.dataset.case===name));}
for(const b of document.querySelectorAll('[data-case]'))b.onclick=()=>{const [bounds,start,end]=cases[b.dataset.case];$('product').value='viirs_snpp';$('processing').value='standard';$('filters').confidence.value='all';$('bbox').value=bounds;$('region').value='custom';$('start').value=start;$('end').value=end;$('map').setAttribute('viewBox','0 0 1000 500');markPreset(b.dataset.case);refresh();};
async function loadEvaluation(){try{const e=await get('/api/evaluation');const box=$('evaluation-results');box.replaceChildren();
 const cards=element('div',undefined,'eval-metrics');for(const [label,value]of [['Selected mapping',e.selected_model.kind],['Held-out mean absolute error',Math.round(e.test.mae).toLocaleString()],['Change in MAE vs raw',e.improvement_vs_raw_pct.toFixed(1)+'% lower'],['Empirical interval coverage',(e.interval.held_out_coverage*100).toFixed(1)+'%']]){const card=element('div');card.append(element('span',label),element('strong',value));cards.append(card);}box.append(cards);
 const table=element('table'),head=element('tr');for(const title of ['Method','2022 selection MAE','2024-25 test MAE','Test bias'])head.append(element('th',title));table.append(head);
 for(const c of e.candidates){const row=element('tr');for(const v of [c.model.kind,Math.round(c.validation.mae).toLocaleString(),Math.round(c.test.mae).toLocaleString(),Math.round(c.test.bias).toLocaleString()])row.append(element('td',v));table.append(row);}box.append(table);
 const note=element('p','These are hotspot-count prediction errors within the tested regions, not fire-risk scores. No global or pre-2012 transfer claim.','muted');box.append(note);
 const baseline=element('p',e.improvement_vs_ratio_pct.toFixed(1)+'% lower held-out MAE than the fitted ratio baseline; '+e.test.n+' region-month test pairs.','muted');box.append(baseline);
 for(const region of e.regions){
  const details=element('details'),summary=element('summary',region.name+' - experimental adjusted calendar (2024-2025)');details.append(summary);
  const table=element('table'),header=element('tr');for(const title of ['Month','Raw MODIS','Mapped estimate','Observed VIIRS','Residual interval'])header.append(element('th',title));table.append(header);
  for(const r of e.test_predictions.filter(r=>r.region===region.name)){const row=element('tr');for(const v of [r.month,fmt(r.modis),fmt(Math.round(r.adjusted)),fmt(r.viirs),fmt(Math.round(r.lower))+' to '+fmt(Math.round(r.upper))])row.append(element('td',v));table.append(row);}details.append(table);box.append(details);
 }
 for(const text of e.limitations)$('evaluation-limitations').append(element('li',text));
 }catch(e){$('evaluation-results').textContent='Evaluation unavailable: '+e.message;}}
