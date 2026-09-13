import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../server/api.mjs';
import {validateLesson} from '../public/lesson-schema.js';
import {starter} from '../public/starter.js';
const request=(body={claim:'Heavier objects fall faster'},headers={})=>new Request('https://lab.test/api/lessons',{method:'POST',headers:{'content-type':'application/json',origin:'https://lab.test','oai-authenticated-user-id':'test-user',...headers},body:JSON.stringify(body)});
const key={OPENAI_API_KEY:'test-secret'};
test('rejects unauthenticated and cross-origin generation before API call',async()=>{
 assert.equal((await handleAPI(request(undefined,{'oai-authenticated-user-id':''}),key)).status,401);
 assert.equal((await handleAPI(request(undefined,{origin:'null'}),key)).status,403);
});
test('validates claim and requires server configuration',async()=>{
 assert.equal((await handleAPI(request({claim:'x'}),key)).status,400);
 assert.equal((await handleAPI(request({claim:'x'.repeat(601)}),key)).status,400);
 assert.equal((await handleAPI(request(),{})).status,503);
});
test('returns a validated lesson with generated code through Responses API',async()=>{
 const mock=async(url,init)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(init.body);
  assert.equal(body.model,'gpt-6-astra');assert.equal(body.store,false);
  assert.equal(body.text.format.type,'json_schema');
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(starter.lesson)}]}]});
 };
 const response=await handleAPI(request(),key,mock);assert.equal(response.status,200);
 const lesson=await response.json();assert.equal(lesson.source,'astra');assert.ok(lesson.lesson.code.includes('return'));
 assert.ok(!JSON.stringify(lesson).includes('test-secret'));
});
test('upstream errors and malformed code contracts are recoverable, without exposing upstream details',async()=>{
 const response=await handleAPI(request(),key,async()=>Response.json({error:{message:'test-secret'}},{status:401}));
 assert.equal(response.status,502);assert.ok(!(await response.text()).includes('test-secret'));
 const invalid=await handleAPI(request(),key,async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}));
 assert.equal(invalid.status,502);
});
test('handles refusal and incomplete responses honestly',async()=>{
 for(const output of [{status:'incomplete'},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}]){
  assert.equal((await handleAPI(request(),key,async()=>Response.json(output))).status,502);
 }
});
test('rejects invalid ranges, duplicate control ids, and invalid answer indices',()=>{
 assert.equal(validateLesson(starter.lesson),true);
 for(const mutate of [x=>x.controls[0].step=0,x=>x.controls.push(x.controls[0]),x=>x.prediction.correctIndex=99,x=>x.code='',x=>x.controls[0].id='__proto__']){
  const x=structuredClone(starter.lesson);mutate(x);assert.equal(validateLesson(x),false);
 }
});
