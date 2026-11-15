// Static scan of the offline demo for external asset references (ad-hoc verification).
import {readFileSync} from 'node:fs';
const h=readFileSync('dist/FireSense-demo.html','utf8');
const refs=[...h.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
console.log(JSON.stringify({
 all_refs:refs,
 scripts:(h.match(/<script/g)||[]).length,
 stylesheets:(h.match(/<link[^>]*stylesheet/g)||[]).length,
 imgs:(h.match(/<img/g)||[]).length,
 banner:/OFFLINE REAL-DATA DEMO/.test(h),
 snapshot_date:h.match(/Snapshot: ([0-9TZ:.\-]+)/)?.[1]
},null,1));
