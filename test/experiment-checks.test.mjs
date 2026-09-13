import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightLesson,validateExperimentResult,buildTestMatrix} from '../public/experiment-checks.js';
import {starter} from '../public/starter.js';
const good=()=>({marks:[{type:'circle',x:50,y:50,r:10}],metrics:[{label:'Time',value:'1 s'}],summary:'Rendered.'});
test('matrix covers initial, each control boundary, responsive widths and animation progress',()=>{
 const cases=buildTestMatrix(starter.lesson);
 for(const width of [320,720])for(const progress of [0,.5,1]){
  const matching=cases.filter(c=>c.viewport.width===width&&c.viewport.progress===progress);assert.ok(matching.some(c=>c.params.mass_a===100&&c.params.mass_b===1000&&c.params.air===0));
  for(const control of starter.lesson.controls)for(const value of [control.min,control.max])assert.ok(matching.some(c=>c.params[control.id]===value));
 }
});
test('preflight uses injected sandbox results and returns factual repair evidence with progress',async()=>{
 let progress=0;const result=await preflightLesson(starter.lesson,async(params,viewport)=>{if(params.air===1&&viewport.width===320)throw Error('worker timed out');return good();},{onProgress:p=>{progress++;assert.ok(p.completed<=p.total)}});
 assert.equal(result.passed,false);assert.ok(result.checks.some(c=>!c.passed&&c.detail.includes('worker timed out')&&c.detail.includes('320')));assert.ok(result.runs.length>0);assert.equal(result.runs[0].summary,'Rendered.');assert.ok(progress>0);
});
test('nonfinite and malformed drawing output cannot pass silently',async()=>{
 for(const marks of [[{type:'circle',x:NaN,y:20,r:10}],[{type:'rect',x:1,y:2,w:-1,h:20}],[{type:'polyline',points:[{x:1,y:Infinity}]}],[{type:'mystery',x:1,y:1}]])assert.throws(()=>validateExperimentResult({...good(),marks}));
 const result=await preflightLesson(starter.lesson,async()=>({...good(),marks:[]}));assert.equal(result.passed,false);assert.equal(result.runs.length,0);
});
test('invalid control steps fail preflight without running code',async()=>{
 const lesson=structuredClone(starter.lesson);lesson.controls[0].initial=150;const result=await preflightLesson(lesson,()=>{throw Error('should not execute')});assert.equal(result.passed,false);assert.equal(result.runs.length,0);assert.match(result.checks[0].detail,/step/i);
});
test('preflight abort does not report an aborted candidate as a completed test',async()=>{
 const controller=new AbortController();await assert.rejects(preflightLesson(starter.lesson,async()=>{controller.abort();return good()},{signal:controller.signal}),{name:'AbortError'});
});
test('matrix also samples all controls at their minimum and maximum together',()=>{
 const cases=buildTestMatrix(starter.lesson);
 for(const bound of ['min','max'])assert.ok(cases.some(c=>starter.lesson.controls.every(control=>c.params[control.id]===control[bound])));
});
test('review-ready results require one to four nonempty metrics',()=>{
 for(const metrics of [[],[{label:'',value:'1 s'}],[{label:'Time',value:''}],[{label:' ',value:'1 s'}],[{label:'Time',value:' '}]])assert.throws(()=>validateExperimentResult({...good(),metrics}),/metric/i);
});
