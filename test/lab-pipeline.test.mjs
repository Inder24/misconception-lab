import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCheckedLesson} from '../public/lab-pipeline.js';
import {starter} from '../public/starter.js';

const lesson = structuredClone(starter.lesson);
const envelope = code => ({id:'candidate',source:'astra',lesson:{...lesson,code}});
const pass = {passed:true,checks:[{name:'Execution',passed:true,detail:'3 cases passed'}],runs:[{params:{},viewport:{width:320,height:340,progress:1},metrics:[],summary:'Observed'}]};

test('a failed candidate is repaired from observed failures before it is released', async () => {
  const result = await buildCheckedLesson({endpoint:'/api/lessons',payload:{claim:lesson.claim},
    request:async(path,body)=>path==='/api/lessons'?envelope('broken'):path==='/api/review'?{passed:true,summary:'Consistent',issues:[]}:envelope(body.failures[0].detail==='Runtime error'?'fixed':'still broken'),
    check:async l=>l.code==='broken'?{passed:false,checks:[{name:'Execution',passed:false,detail:'Runtime error'}],runs:[]}:pass});
  assert.equal(result.lesson.code,'fixed');
  assert.equal(result.validation.repairs,1);
  assert.equal(result.validation.runtime.passed,true);
  assert.equal(result.validation.review.passed,true);
  assert.ok(result.validation.receipt.some(x=>x.stage==='repair'));
});

test('scientific review failures enter the same bounded repair loop', async () => {
  const result = await buildCheckedLesson({endpoint:'/api/revise',payload:{lesson,request:'Change gravity'},
    request:async(path,body)=>path==='/api/review'?{passed:body.lesson.code==='fixed',summary:'Review',issues:body.lesson.code==='fixed'?[]:[{name:'Units',detail:'Use seconds'}]}:envelope(path==='/api/repair'?'fixed':'wrong units'),check:async()=>pass});
  assert.equal(result.lesson.code,'fixed');
  assert.equal(result.validation.repairs,1);
});

test('failed repairs never release a candidate and stop after two attempts', async () => {
  let repairs=0;
  await assert.rejects(buildCheckedLesson({endpoint:'/api/lessons',payload:{claim:lesson.claim},
    request:async path=>{if(path==='/api/repair')repairs++;return envelope('broken');},
    check:async()=>({passed:false,checks:[{name:'Output',passed:false,detail:'Not finite'}],runs:[]})}),error=>error.name==='ExperimentBuildError'&&error.receipt.filter(x=>x.stage==='repair').length===2);
  assert.equal(repairs,2);
});

test('cancellation during checks does not publish or request another operation', async () => {
  const controller=new AbortController();let calls=0;
  await assert.rejects(buildCheckedLesson({endpoint:'/api/lessons',payload:{claim:lesson.claim},signal:controller.signal,
    request:async()=>{calls++;return envelope('fine');},check:async()=>{controller.abort();return pass;}}),{name:'AbortError'});
  assert.equal(calls,1);
});

test('sandbox initialization errors become repairable observed failures', async () => {
  const result=await buildCheckedLesson({endpoint:'/api/lessons',payload:{claim:lesson.claim},
    request:async path=>path==='/api/review'?{passed:true,summary:'Reviewed',issues:[]}:envelope(path==='/api/repair'?'fixed':'syntax error'),
    check:async l=>{if(l.code==='syntax error')throw Error('Could not initialize');return pass;}});
  assert.equal(result.validation.repairs,1);
  assert.equal(result.lesson.code,'fixed');
});

test('large failed matrices send bounded observed evidence so repair remains possible', async()=>{
 const failures=Array.from({length:66},(_,i)=>({name:`Run ${i}`,passed:false,detail:`Failed case ${i}`}));
 const result=await buildCheckedLesson({endpoint:'/api/lessons',payload:{claim:lesson.claim},
  request:async(path,body)=>{if(path==='/api/review')return {passed:true,summary:'Reviewed',issues:[]};if(path==='/api/repair'){if(body.failures.length>40)throw Error('Request too large');return envelope('fixed');}return envelope('broken');},
  check:async l=>l.code==='broken'?{passed:false,checks:failures,runs:[]}:pass});
 assert.equal(result.lesson.code,'fixed');
});
