import test from 'node:test';
import assert from 'node:assert/strict';
import {LabState} from '../public/lab-state.js';
import {starter} from '../public/starter.js';
const result={marks:[{type:'circle',x:1,y:1,r:1}],metrics:[{label:'A',value:'1 s'}],summary:'Both land together.'};
const predict=s=>s.predict({selectedIndex:2,reason:'Same acceleration',confidence:80});
test('results and answer keys stay hidden until a successful run after prediction',()=>{
 const s=new LabState(starter);assert.equal(s.read().results,null);assert.ok(!JSON.stringify(s.read()).includes('correctIndex'));
 assert.throws(()=>s.recordRun(result),/prediction/i);predict(s);assert.equal(s.phase,'test');s.recordRun(result);assert.equal(s.phase,'explain');assert.equal(s.read().results.summary,result.summary);
});
test('control changes retain immutable original prediction and invalidate current results',()=>{
 const s=new LabState(starter);predict(s);s.recordRun(result);const initial=s.prediction;s.setControl('air',1);
 assert.deepEqual(s.prediction,initial);assert.equal(s.prediction.params.air,0);assert.equal(s.params.air,1);assert.equal(s.results,null);assert.throws(()=>{s.prediction.params.air=1},TypeError);
 assert.throws(()=>s.predict({selectedIndex:0,reason:'change',confidence:50}),/already/i);
});
test('invalid, off-grid and stale mutations are atomic',()=>{
 const s=new LabState(starter);const original=s.params;
 for(const patch of [{air:NaN},{air:2},{mass_a:150},{surprise:1},{air:1,mass_a:150}])assert.throws(()=>s.setParams(patch));
 assert.deepEqual(s.params,original);assert.throws(()=>s.setControl('air',1,{lessonId:s.identity.lessonId,version:99}),/stale/i);
 predict(s);assert.throws(()=>s.recordRun(result,{params:{...s.params,air:1}}),/conditions/i);assert.equal(s.results,null);
});
test('pinned results survive changed conditions and new lesson versions without aliasing',()=>{
 const s=new LabState(starter);predict(s);s.recordRun(result);s.pinRun();result.summary='mutated input';s.setControl('air',1);
 assert.equal(s.pinned.results.summary,'Both land together.');s.accept({...starter,version:2});assert.equal(s.pinned.version,1);assert.equal(s.version,2);assert.equal(s.prediction,null);assert.equal(s.results,null);
});
test('invalid prediction and invalid output cannot reveal results',()=>{
 const s=new LabState(starter);for(const p of [{selectedIndex:9,reason:'why',confidence:50},{selectedIndex:1,reason:'why',confidence:101}])assert.throws(()=>s.predict(p));
 predict(s);assert.throws(()=>s.recordRun({...result,marks:[{type:'circle',x:Infinity,y:1,r:1}]}));assert.equal(s.results,null);
});
test('large numeric controls cannot bypass step validation',()=>{
 const item=structuredClone(starter);item.lesson.controls[0]={...item.lesson.controls[0],min:0,max:1e9,step:1,initial:0};const s=new LabState(item);
 assert.throws(()=>s.setControl('mass_a',1e9-.25),/step/);
});

test('optional learner reason is trimmed and stored without blocking a prediction',()=>{
 const s=new LabState(starter);s.predict({selectedIndex:1,reason:'  ',confidence:50});assert.equal(s.prediction.reason,'');assert.equal(s.phase,'test');
});
