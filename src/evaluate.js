import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openDb,ROOT,DB_PATH} from './db.js';
export const REGIONS=[{name:'California bounds',bbox:[-125,32,-114,42]},{name:'Pacific Northwest bounds',bbox:[-125,42,-116,49]},{name:'Southeastern U.S. bounds',bbox:[-90,25,-75,36]}];
export function fit(rows,kind){
 if(!rows.length)throw new Error('No training pairs');
 const ratio=rows.reduce((n,r)=>n+r.viirs,0)/rows.reduce((n,r)=>n+r.modis,0);
 if(kind==='identity')return {kind};
 if(kind==='ratio')return {kind,ratio};
 const xs=rows.map(r=>Math.log1p(r.modis)),ys=rows.map(r=>Math.log1p(r.viirs));
 const mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
 const denominator=xs.reduce((s,x)=>s+(x-mx)**2,0);
 const slope=denominator?xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/denominator:0;
 return {kind:'loglinear',slope,intercept:my-slope*mx};
}
export function predict(model,x){return model.kind==='identity'?x:model.kind==='ratio'?x*model.ratio:Math.max(0,Math.expm1(model.intercept+model.slope*Math.log1p(x)));}
export function metrics(rows,model){if(!rows.length)return null;const errors=rows.map(r=>predict(model,r.modis)-r.viirs);return {n:rows.length,mae:errors.reduce((n,e)=>n+Math.abs(e),0)/rows.length,rmse:Math.sqrt(errors.reduce((n,e)=>n+e*e,0)/rows.length),bias:errors.reduce((n,e)=>n+e,0)/rows.length};}
function monthly(db,product,bbox){const [w,s,e,n]=bbox;return db.prepare(`SELECT substr(d.date,1,7) month,SUM(d.nominal) count FROM daily d JOIN sources s ON s.id=d.source_id WHERE s.product=? AND s.processing='standard' AND s.status='ready' AND d.date BETWEEN '2013-01-01' AND '2025-12-31' AND d.x+0.5>=? AND d.x+0.5<? AND d.y+0.5>=? AND d.y+0.5<? GROUP BY month HAVING SUM(d.nominal)>0 ORDER BY month`).all(product,w+180,e+180,s+90,n+90);}
export function evaluate(db){
 const regions=REGIONS.map(region=>{
  const modis=new Map(monthly(db,'modis',region.bbox).map(r=>[r.month,r.count]));
  const viirs=new Map(monthly(db,'viirs_snpp',region.bbox).map(r=>[r.month,r.count]));
  const months=[...new Set([...modis.keys(),...viirs.keys()])].sort();
  const pairs=months.filter(m=>modis.has(m)&&viirs.has(m)).map(month=>({month,modis:modis.get(month),viirs:viirs.get(month)}));
  return {...region,pairs,unpaired_months:months.filter(m=>!modis.has(m)||!viirs.has(m))};
 });
 const all=regions.flatMap(r=>r.pairs.map(p=>({...p,region:r.name}))),train=all.filter(r=>r.month<'2022'),validation=all.filter(r=>r.month.startsWith('2022')),calibration=all.filter(r=>r.month.startsWith('2023')),test=all.filter(r=>r.month>='2024');
 if(!train.length||!validation.length||!calibration.length||!test.length)throw new Error('Insufficient independent year splits for evaluation');
 const candidates=['identity','ratio','loglinear'].map(kind=>{const model=fit(train,kind);return {model,validation:metrics(validation,model),test:metrics(test,model)};});
 const selected=[...candidates].sort((a,b)=>a.validation.mae-b.validation.mae)[0];
 const residuals=calibration.map(r=>Math.abs(predict(selected.model,r.modis)-r.viirs)).sort((a,b)=>a-b);
 const radius=residuals[Math.min(residuals.length-1,Math.ceil(.9*(residuals.length+1))-1)];
 const testPredictions=test.map(r=>({...r,adjusted:predict(selected.model,r.modis),lower:Math.max(0,predict(selected.model,r.modis)-radius),upper:predict(selected.model,r.modis)+radius}));
 const intervalCoverage=testPredictions.filter(r=>r.viirs>=r.lower&&r.viirs<=r.upper).length/test.length;
 const identity=candidates.find(c=>c.model.kind==='identity'),ratio=candidates.find(c=>c.model.kind==='ratio');
 return {generated_at:new Date().toISOString(),database:relative(ROOT,DB_PATH).replaceAll('\\','/'),status:'experimental_held_out_evaluation',target:'VIIRS S-NPP nominal/high monthly detection counts from MODIS >=30 monthly detection counts',splits:{train:'2013-2021',selection:'2022',interval_calibration:'2023',test:'2024-2025'},regions:regions.map(({pairs,...r})=>({...r,paired_months:pairs.length,test:metrics(test.filter(p=>p.region===r.name),selected.model)})),training_pairs:train.length,candidates,selected_model:selected.model,test:selected.test,improvement_vs_raw_pct:100*(identity.test.mae-selected.test.mae)/identity.test.mae,improvement_vs_ratio_pct:100*(ratio.test.mae-selected.test.mae)/ratio.test.mae,interval:{absolute_residual_radius:radius,nominal_level:.9,held_out_coverage:intervalCoverage,calibration_pairs:calibration.length},test_predictions:testPredictions,
  limitations:['Regional bounding boxes use grid-cell centers, not administrative polygons.','Only months with qualifying detections in both sensors are included; missing months are not zeros. This selection can bias evaluation.','Year holdout tests temporal transfer in three existing regions; geographic generalization is not validated.','No cloud, overpass, view-angle or observation-opportunity normalization.','MODIS combines Terra and Aqua; platform/product versions and confidence definitions differ.','Intervals describe empirical residuals; time/space dependence prevents a guaranteed coverage interpretation.','Mapping is experimental. Do not apply globally, to pre-2012 history, to NRT, or as a forecast.','Hotspots include non-vegetation thermal anomalies; no wildfire/agricultural classification is inferred.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const db=openDb();try{const report=evaluate(db);mkdirSync(resolve(ROOT,'outputs'),{recursive:true});writeFileSync(resolve(ROOT,'outputs/evaluation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({model:report.selected_model,test:report.test,improvement_vs_raw_pct:report.improvement_vs_raw_pct,interval:report.interval},null,2));}finally{db.close();}}
