import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../server/api.mjs';
import {starter} from '../public/starter.js';

const lesson=starter.lesson;
const params=Object.fromEntries(lesson.controls.map(control=>[control.id,control.initial]));
const steps=[
 {id:'release',title:'Start together',focus:'Both objects start from rest at the same height.',params,progress:0,results:{metrics:[{label:'Landing time',value:'1.01 s'}],summary:'The two spheres reach the ground together.'}},
 {id:'compare',title:'Compare their motion',focus:'Compare both landing times without air resistance.',params,progress:1,results:{metrics:[{label:'Landing time',value:'1.01 s'}],summary:'The two spheres reach the ground together.'}},
];
const brief={topic:'Falling objects',grade:'Grade 6',subject:'Science',learningGoal:'Compare force and acceleration.',observedBeliefs:'Heavier objects always fall faster.',includeQuickChecks:true};
const body={lesson,steps,brief};
const answer={intro:'Compare these two equal-size spheres.',steps:[{id:'release',narration:'This frame shows the shared starting height; the listed time is the final landing time.'},{id:'compare',narration:'Both reach the ground in 1.01 seconds. Without air resistance, mass does not change gravitational acceleration.'}]};
const env={OPENAI_API_KEY:'test-key'};
const request=(data=body,headers={})=>new Request('https://lab.test/api/walkthrough',{method:'POST',headers:{'content-type':'application/json',origin:'https://lab.test','oai-authenticated-user-id':'walkthrough-test',...headers},body:JSON.stringify(data)});
const upstream=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('walkthrough requires same-origin authenticated JSON and a configured key',async()=>{
 let calls=0;const remote=async()=>{calls++;return upstream(answer);};
 for(const [headers,status]of [[{'oai-authenticated-user-id':''},401],[{origin:'https://other.test'},403],[{'content-type':'text/plain'},415]])assert.equal((await handleAPI(request(body,headers),env,remote)).status,status);
 assert.equal((await handleAPI(request(),{},remote)).status,503);
 assert.equal((await handleAPI(new Request('https://lab.test/api/walkthrough'),env,remote)).status,405);
 assert.equal(calls,0);
});

test('walkthrough rejects invalid step identity, conditions and measured results before generation',async()=>{
 const malformed=[[],Array(5).fill(steps[0]),[steps[0],steps[0]],...[
  {id:''},{id:'x'.repeat(41)},{title:' '},{focus:'x'.repeat(501)},{progress:-.01},{progress:1.01},
  {params:{}},{params:{...params,air:.5}},{results:{metrics:[],summary:'No measurements'}},
 ].map(patch=>[{...steps[0],...patch}])];
 let calls=0;const remote=async()=>{calls++;return upstream(answer);};
 for(const candidate of malformed)assert.equal((await handleAPI(request({...body,steps:candidate}),env,remote)).status,400);
 assert.equal((await handleAPI(request({...body,brief:{...brief,grade:''}}),env,remote)).status,400);
 assert.equal(calls,0);
});

test('walkthrough grounds bounded narration in the supplied ordered steps and teaching context',async()=>{
 let sent;const response=await handleAPI(request(),env,async(_,init)=>{sent=JSON.parse(init.body);return upstream(answer);});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),answer);
 assert.deepEqual(JSON.parse(sent.input),body);assert.equal(sent.text.format.name,'experiment_walkthrough');assert.equal(sent.text.format.strict,true);
 assert.deepEqual(Object.keys(sent.text.format.schema.properties),['intro','steps']);
 assert.deepEqual(Object.keys(sent.text.format.schema.properties.steps.items.properties),['id','narration']);
 assert.match(sent.instructions,/final results/i);assert.match(sent.instructions,/intermediate/i);assert.match(sent.instructions,/never.*instructions/i);
 assert.equal(sent.max_output_tokens,1800);assert.deepEqual(sent.reasoning,{effort:'medium'});
});

test('walkthrough rejects reordered, missing, oversized or action-bearing narration and contains upstream errors',async()=>{
 const malformed=[{...answer,steps:[...answer.steps].reverse()},{...answer,steps:answer.steps.slice(0,1)},
  {...answer,intro:'x'.repeat(401)},{...answer,steps:[{...answer.steps[0],narration:'x'.repeat(601)},answer.steps[1]]},
  {...answer,steps:[{...answer.steps[0],params},{...answer.steps[1]}]},
 ];
 for(const value of malformed){const response=await handleAPI(request(),env,async()=>upstream(value));assert.equal(response.status,502);assert.equal((await response.json()).code,'invalid_output');}
 const response=await handleAPI(request(),env,async()=>Response.json({error:'sensitive upstream detail'},{status:429}));
 assert.equal(response.status,502);const result=await response.json();assert.equal(result.code,'upstream_error');assert.match(result.error,/rate-limited/);assert.doesNotMatch(result.error,/sensitive/);
 assert.equal((await handleAPI(request(),env,async()=>upstream(answer))).status,200,'a failed response releases the per-user lock');
});
