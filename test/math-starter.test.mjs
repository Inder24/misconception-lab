import test from 'node:test';
import assert from 'node:assert/strict';
import {mathStarter,percentageState,percentageExperiment} from '../public/math-starter.js';
import {preflightLesson,validateExperimentResult} from '../public/experiment-checks.js';

const params={initial_amount:100,discount:50,increase:50};
test('successive percentages use the new amount as their base',()=>{
 assert.deepEqual(percentageState(params),{initial:100,afterDiscount:50,final:75,discountAmount:50,increaseAmount:25,recoveryPercent:100});
 const recovery=percentageState({...params,increase:100});assert.equal(recovery.final,100);
 assert.equal(percentageState({...params,discount:0}).recoveryPercent,0);
 assert.equal(percentageState({...params,initial_amount:0}).recoveryPercent,0);
 assert.equal(percentageState({...params,discount:100}).recoveryPercent,null);
});
test('staged receipts reveal the changed base while keeping final measurements stable',()=>{
 const frames=[0,.5,1].map(progress=>percentageExperiment(params,{width:390,height:460,progress}));
 const labels=frame=>frame.marks.filter(m=>m.type==='text').map(m=>m.text);
 assert.ok(labels(frames[0]).includes('$100.00'));assert.ok(!labels(frames[0]).includes('$50.00'));assert.ok(!labels(frames[0]).includes('$75.00'));
 assert.ok(labels(frames[1]).includes('$50.00'));assert.ok(!labels(frames[1]).includes('$75.00'));assert.ok(labels(frames[2]).includes('$75.00'));
 assert.deepEqual(frames[0].metrics,frames[2].metrics);assert.deepEqual(frames[1].metrics,frames[2].metrics);
 assert.deepEqual(frames[2].metrics.map(m=>m.value),['$100.00','$50.00','$75.00','−$25.00']);
 const discounting=percentageExperiment(params,{width:390,height:460,progress:.25}),increasing=percentageExperiment(params,{width:390,height:460,progress:.75});
 assert.ok(labels(discounting).includes('$75.00'));assert.ok(labels(discounting).includes('Applying the discount…'));
 assert.ok(labels(increasing).includes('$62.50'));assert.ok(labels(increasing).includes('Adding the increase…'));
 assert.deepEqual(discounting.metrics,frames[2].metrics);assert.deepEqual(increasing.metrics,frames[2].metrics);
});
test('money bars stay within the responsive stage across control bounds',async()=>{
 const report=await preflightLesson(mathStarter.lesson,async(p,v)=>percentageExperiment(p,v));assert.ok(report.passed,JSON.stringify(report.checks.filter(c=>!c.passed)));
 for(const width of [260,390,720])for(const height of [340,460])for(const p of [params,{initial_amount:10,discount:80,increase:0},{initial_amount:200,discount:0,increase:200}])for(const progress of [0,.5,1]){
  const result=percentageExperiment(p,{width,height,progress});validateExperimentResult(result,{requireMarks:true});
  for(const mark of result.marks){assert.ok(mark.x>=0&&mark.x<=width&&mark.y>=0&&mark.y<=height);if(mark.type==='rect')assert.ok(mark.x+mark.w<=width&&mark.y+mark.h<=height);}
 }
});
