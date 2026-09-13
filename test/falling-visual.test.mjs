import test from 'node:test';
import assert from 'node:assert/strict';
import {starter} from '../public/starter.js';
import {fallingState} from '../public/falling-model.js';
import {preflightLesson,validateExperimentResult} from '../public/experiment-checks.js';
const run=new Function('params','viewport',starter.lesson.code);
const params={mass_a:100,mass_b:1000,air:0};
test('changing release height changes the vacuum fall time for both masses',()=>{
 const low=run({...params,height:1},{width:720,height:460,progress:1});
 const high=run({...params,height:10},{width:720,height:460,progress:1});
 assert.equal(low.metrics[0].value,'0.45 s');assert.equal(low.metrics[1].value,'0.45 s');
 assert.equal(high.metrics[0].value,'1.43 s');assert.equal(high.metrics[1].value,'1.43 s');
});
test('falling visual makes both masses and elapsed simulation time explicit',()=>{
 const result=run(params,{width:720,height:340,progress:.5});
 const labels=result.marks.filter(x=>x.type==='text').map(x=>x.text);
 assert.ok(labels.some(x=>x.includes('100 g')));assert.ok(labels.some(x=>x.includes('1000 g')));
 assert.ok(labels.some(x=>x.includes('Elapsed')));
});
test('release preview does not disclose future landing times',()=>{
 const labels=run({...params,height:5},{width:720,height:460,progress:0}).marks.filter(x=>x.type==='text').map(x=>x.text);
 assert.ok(!labels.some(x=>/1\.01 s/.test(x)));assert.ok(labels.some(x=>/Ready/.test(x)));
});
test('shared playback model gives rest, physical motion and first-contact state',()=>{
 for(const height of [1,10]){
  const start=fallingState({...params,height},0),mid=fallingState({...params,height},.5),end=fallingState({...params,height},1);
  assert.equal(start.a.speed,0);assert.equal(start.b.speed,0);assert.equal(start.a.landed,false);
  assert.ok(Math.abs(mid.a.distance-height/4)<1e-10);assert.ok(Math.abs(mid.a.speed-9.81*Math.sqrt(2*height/9.81)/2)<1e-10);
  assert.ok(Math.abs(end.duration-Math.sqrt(2*height/9.81))<1e-10);assert.equal(end.a.distance,height);assert.equal(end.a.speed,0);assert.equal(end.b.speed,0);assert.equal(end.gap,0);
 }
 const drag=fallingState({...params,height:5,air:1}),vacuum=fallingState({...params,height:5});
 assert.ok(drag.a.landingTime>drag.b.landingTime);assert.ok(drag.b.landingTime>vacuum.b.landingTime);
 const first=fallingState({...params,height:5,air:1},drag.b.landingTime/drag.duration);
 assert.equal(first.b.landed,true);assert.equal(first.b.speed,0);assert.equal(first.a.landed,false);assert.ok(first.a.speed>0);assert.ok(first.a.distance<5);
 assert.equal(fallingState({...params,mass_a:1000,air:1,height:5}).gap,0);
});
test('illustrated falling model preserves vacuum and drag results across playback and widths',async()=>{
 const report=await preflightLesson(starter.lesson,async(p,v)=>run(p,v));assert.equal(report.passed,true);
 for(const width of [260,390,720]){
 const before=run(params,{width,height:340,progress:0}),after=run(params,{width,height:340,progress:1});
 assert.deepEqual(before.metrics,after.metrics);assert.equal(after.metrics[0].value,'1.01 s');assert.equal(after.metrics[1].value,'1.01 s');
 const drag=run({...params,air:1},{width,height:340,progress:1});assert.ok(parseFloat(drag.metrics[0].value)>parseFloat(drag.metrics[1].value));
 }
 for(const width of [260,390,720])for(const height of [340,460])for(const release of [1,5,10])for(const progress of [0,.5,1]){
  const result=run({...params,height:release,air:1},{width,height,progress});validateExperimentResult(result,{requireMarks:true});
  for(const mark of result.marks){
   assert.ok(mark.x>=0&&mark.x<=width&&mark.y>=0&&mark.y<=height);
   if(mark.type==='circle')assert.ok(mark.x-mark.r>=0&&mark.x+mark.r<=width&&mark.y-mark.r>=0&&mark.y+mark.r<=height);
   if(mark.type==='rect')assert.ok(mark.x+mark.w<=width&&mark.y+mark.h<=height);
  }
 }
});
