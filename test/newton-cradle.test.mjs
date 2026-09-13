import test from 'node:test';
import assert from 'node:assert/strict';
import {cradleExperiment,newtonCradle} from '../public/newton-cradle.js';
import {preflightLesson} from '../public/experiment-checks.js';
const view={width:720,height:340,progress:0};
const values=r=>Object.fromEntries(r.metrics.map(m=>[m.label,m.value]));
test('height changes speed and peak, not transferred ball count',()=>{
 const a=values(cradleExperiment({height:5,mass:100,swings:3},view));
 const b=values(cradleExperiment({height:20,mass:100,swings:3},view));
 assert.equal(a['Speed at first impact'],'0.99 m/s');assert.equal(b['Speed at first impact'],'1.98 m/s');assert.equal(b['Opposite peak height'],'20 cm');assert.match(cradleExperiment({height:20,mass:100,swings:3},view).summary,/One ball released/);

});
test('cradle passes complete sandbox contract matrix and keeps measurements stable',async()=>{
 const report=await preflightLesson(newtonCradle.lesson,async(params,viewport)=>cradleExperiment(params,viewport));assert.ok(report.passed,JSON.stringify(report.checks.filter(c=>!c.passed)));
 const params={height:25,mass:500,swings:5};
 const first=cradleExperiment(params,view);
 for(const progress of [.025,.1,.25,.5,.75,1]){const next=cradleExperiment(params,{...view,progress});assert.deepEqual(next.metrics,first.metrics);assert.equal(next.summary,first.summary);}
 assert.notDeepEqual(cradleExperiment(params,{...view,progress:.1}).marks,first.marks);
});

test('equal mass adjustment scales energy without changing speed or peak height',()=>{
 const light=values(cradleExperiment({height:20,mass:100,swings:3},view));
 const heavy=values(cradleExperiment({height:20,mass:200,swings:3},view));
 assert.equal(light['Energy in the swing'],'0.196 J');assert.equal(heavy['Energy in the swing'],'0.392 J');
 assert.equal(light['Speed at first impact'],heavy['Speed at first impact']);assert.equal(light['Opposite peak height'],heavy['Opposite peak height']);
 assert.equal(newtonCradle.lesson.controls.some(c=>c.id==='balls'),false);
});
