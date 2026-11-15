import test from 'node:test';
import assert from 'node:assert/strict';
import {fit,predict,metrics} from '../src/evaluate.js';
test('empirical mapping fits training only and evaluates separate observations',()=>{
 const training=[{modis:10,viirs:30},{modis:20,viirs:60}];const m=fit(training,'ratio');
 assert.equal(predict(m,5),15);assert.equal(metrics([{modis:5,viirs:20}],m).mae,5);assert.equal(m.ratio,3);
 assert.equal(metrics([],m),null);assert.throws(()=>fit([],'ratio'),/No training/);
});
