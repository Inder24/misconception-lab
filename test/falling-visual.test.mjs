import test from 'node:test';
import assert from 'node:assert/strict';
import {starter} from '../public/starter.js';
import {preflightLesson} from '../public/experiment-checks.js';
const run=new Function('params','viewport',starter.lesson.code);
const params={mass_a:100,mass_b:1000,air:0};
test('falling visual makes both masses and elapsed simulation time explicit',()=>{
 const result=run(params,{width:720,height:340,progress:.5});
 const labels=result.marks.filter(x=>x.type==='text').map(x=>x.text);
 assert.ok(labels.some(x=>x.includes('100 g')));assert.ok(labels.some(x=>x.includes('1000 g')));
 assert.ok(labels.some(x=>x.includes('Elapsed')));
});
test('illustrated falling model preserves vacuum and drag results across playback and widths',async()=>{
 const report=await preflightLesson(starter.lesson,async(p,v)=>run(p,v));assert.equal(report.passed,true);
 for(const width of [260,390,720]){
 const before=run(params,{width,height:340,progress:0}),after=run(params,{width,height:340,progress:1});
 assert.deepEqual(before.metrics,after.metrics);assert.equal(after.metrics[0].value,'1.01 s');assert.equal(after.metrics[1].value,'1.01 s');
 const drag=run({...params,air:1},{width,height:340,progress:1});assert.ok(parseFloat(drag.metrics[0].value)>parseFloat(drag.metrics[1].value));
 }
});
