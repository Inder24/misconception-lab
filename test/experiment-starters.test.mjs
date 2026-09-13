import test from 'node:test';
import assert from 'node:assert/strict';
import {experimentStarters,buoyancyExperiment,lensExperiment} from '../public/experiment-starters.js';
import {validateLesson} from '../public/lesson-schema.js';
import {preflightLesson,validateExperimentResult} from '../public/experiment-checks.js';
const view={width:720,height:340,progress:1};
const values=result=>Object.fromEntries(result.metrics.map(m=>[m.label,m.value]));
test('curated lessons are complete compatible envelopes with honest catalog metadata',()=>{
 assert.equal(experimentStarters.length,3);assert.equal(new Set(experimentStarters.map(x=>x.id)).size,3);
 for(const item of experimentStarters){assert.ok(validateLesson(item.lesson));assert.equal(item.source,'curated');assert.ok(Number.isInteger(item.version)&&item.version>=1);assert.ok(item.catalog.topic&&item.catalog.grade&&item.catalog.tags.length);assert.equal(item.validation,undefined);}
});
test('buoyancy computes floating equilibrium and fully submerged sinking forces independently',()=>{
 const floating=values(buoyancyExperiment({object_density:500,fluid_density:1000,volume:1},view));
 assert.equal(floating.Weight,'4.91 N');assert.equal(floating.Buoyancy,'4.91 N');assert.equal(floating.Submerged,'50.0%');assert.equal(floating.Outcome,'Floating');
 const sinking=values(buoyancyExperiment({object_density:2000,fluid_density:1000,volume:2},view));
 assert.equal(sinking.Weight,'39.24 N');assert.equal(sinking.Buoyancy,'19.62 N');assert.equal(sinking.Submerged,'100.0%');assert.equal(sinking.Outcome,'Sinking');
 const neutral=values(buoyancyExperiment({object_density:1000,fluid_density:1000,volume:1},view));assert.equal(neutral.Weight,neutral.Buoyancy);assert.equal(neutral.Outcome,'Neutral');
});
test('thin lens gives signed real and virtual image distance and magnification',()=>{
 const real=values(lensExperiment({object_distance:30,focal_length:10,object_height:3},view));
 assert.equal(real['Image distance'],'+15.00 cm');assert.equal(real.Magnification,'−0.50×');assert.equal(real['Image height'],'−1.50 cm');assert.equal(real.Image,'Real · inverted');
 const virtual=values(lensExperiment({object_distance:5,focal_length:10,object_height:2},view));
 assert.equal(virtual['Image distance'],'−10.00 cm');assert.equal(virtual.Magnification,'+2.00×');assert.equal(virtual['Image height'],'+4.00 cm');assert.equal(virtual.Image,'Virtual · upright');
});
test('focal-plane limit is explicit and drawable without numeric infinities',()=>{
 const result=lensExperiment({object_distance:10,focal_length:10,object_height:3},view);validateExperimentResult(result);
 assert.equal(values(result)['Image distance'],'At infinity');assert.equal(values(result).Magnification,'No finite image');assert.match(result.summary,/parallel/);
});
test('both authored models pass every responsive preflight case with invariant playback measurements',async()=>{
 for(const [i,run]of [buoyancyExperiment,lensExperiment].entries()){
  const lesson=experimentStarters[i].lesson;const report=await preflightLesson(lesson,async(params,viewport)=>run(params,viewport));assert.ok(report.passed,JSON.stringify(report.checks.filter(c=>!c.passed)));
  const params=Object.fromEntries(lesson.controls.map(c=>[c.id,c.initial]));assert.deepEqual(run(params,{...view,progress:0}).metrics,run(params,view).metrics);
 }
});
