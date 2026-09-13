import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../server/api.mjs';
import {starter} from '../public/starter.js';
const brief={topic:'Falling objects',grade:'Grade 6',subject:'Science',learningGoal:'Compare gravity and drag.',observedBeliefs:'Heavier objects always fall faster.',includeQuickChecks:true};
const card={id:'falling',claim:'Heavier objects always fall faster.',rationale:'Everyday air resistance can suggest mass alone sets acceleration.',quickCheck:'Which sphere lands first in a vacuum?',experiment:'Compare falling equal-size spheres with drag on and off.',variable:'Air resistance'};
const plan={brief,cards:[card]};
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZucAAAAASUVORK5CYII=';
const imported={brief,regions:[{field:'topic',label:'Topic heading',x:.1,y:.1,width:.7,height:.1}],uncertainty:'The grade is shown; the intended learning goal needs confirmation.'};
const key={OPENAI_API_KEY:'test-key'};
const req=(route,body,headers={})=>new Request('https://lab.test/api/'+route,{method:'POST',headers:{'content-type':'application/json',origin:'https://lab.test','oai-authenticated-user-id':'planner-test',...headers},body:JSON.stringify(body)});
const upstream=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('planner routes enforce security, credentials and input boundaries before upstream',async()=>{
 for(const [route,body] of [['plan',{brief}],['import-brief',{image}]]){
  let calls=0;const remote=async()=>{calls++;return upstream(plan);};
  for(const [headers,status]of [[{'oai-authenticated-user-id':''},401],[{origin:'null'},403],[{'content-type':'text/plain'},415]])assert.equal((await handleAPI(req(route,body,headers),key,remote)).status,status);
  assert.equal((await handleAPI(req(route,body),{},remote)).status,503);
  assert.equal(calls,0);
 }
 for(const body of [{brief:{...brief,topic:'x'}},{brief:{...brief,observedBeliefs:'x'.repeat(1601)}},{brief:{...brief,includeQuickChecks:'yes'}},{brief:{...brief,extra:'override'}}])assert.equal((await handleAPI(req('plan',body),key)).status,400);
 assert.equal((await handleAPI(req('import-brief',{image:'https://example.com/photo.png'}),key)).status,400);
});

test('planner preserves the teacher brief and produces validated editable candidate cards',async()=>{
 let sent;const response=await handleAPI(req('plan',{brief}),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(plan);});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),plan);assert.deepEqual(JSON.parse(sent.input).brief,brief);assert.equal(sent.text.format.type,'json_schema');
 for(const invalid of [{...plan,brief:{...brief,grade:'AP Physics'}},{...plan,cards:[card,card]},{...plan,cards:[{...card,quickCheck:''}]}])assert.equal((await handleAPI(req('plan',{brief}),key,async()=>upstream(invalid))).status,502);
 const unchecked={...brief,includeQuickChecks:false};assert.equal((await handleAPI(req('plan',{brief:unchecked}),key,async()=>upstream({brief:unchecked,cards:[{...card,quickCheck:''}]}))).status,200);
});

test('teaching screenshot import uses image input and rejects unmapped or out-of-image regions',async()=>{
 let sent;const response=await handleAPI(req('import-brief',{image}),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(imported);});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),imported);assert.equal(sent.input[0].content[1].type,'input_image');assert.equal(sent.input[0].content[1].image_url,image);assert.ok(sent.text.format.schema.properties.brief);
 for(const region of [{...imported.regions[0],field:'secret'},{...imported.regions[0],x:.8,width:.7}])assert.equal((await handleAPI(req('import-brief',{image}),key,async()=>upstream({...imported,regions:[region]}))).status,502);
 const fallback={...imported,brief:{...brief,grade:'Not specified',subject:'Not specified'},regions:[],uncertainty:'Grade and subject were not visible; confirm the editable defaults.'};assert.equal((await handleAPI(req('import-brief',{image}),key,async()=>upstream(fallback))).status,200);
});

test('teacher context and selected experiment continue through generation, repair, revision and tutoring',async()=>{
 const lesson=starter.lesson,params={mass_a:100,mass_b:1000,air:0,height:5};
 const payloads={lessons:{claim:card.claim,experimentRequest:card.experiment},repair:{claim:card.claim,lesson,attempt:1,failures:[{name:'Units',detail:'Show seconds.'}]},revise:{lesson,params,request:'Change gravity.'},tutor:{lesson,params,selectedIndex:2,reason:'Equal acceleration.',confidence:80,results:{metrics:[{label:'Time',value:'1.01 s'}],summary:'Together'},history:[]}};
 const tutor={message:'Both accelerate equally.',reasoningFocus:'Acceleration and force.',question:lesson.followup};
 for(const [route,payload]of Object.entries(payloads)){
  let sent;const response=await handleAPI(req(route,{...payload,brief}),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(route==='tutor'?tutor:lesson);});
  assert.equal(response.status,200,route);const result=await response.json();assert.deepEqual(JSON.parse(sent.input).brief,brief,route);if(route!=='tutor')assert.deepEqual(result.brief,brief,route);
  if(route==='lessons')assert.equal(JSON.parse(sent.input).experimentRequest,card.experiment);
  assert.equal((await handleAPI(req(route,{...payload,brief:{...brief,grade:''}}),key)).status,400,route);
 }
 for(const experimentRequest of [null,3,'x'.repeat(2401)])assert.equal((await handleAPI(req('lessons',{claim:card.claim,experimentRequest}),key)).status,400);
 assert.equal((await handleAPI(req('lessons',{claim:card.claim,experimentRequest:'x'.repeat(2400)}),key,async()=>upstream(lesson))).status,200);
 const without=await handleAPI(req('lessons',{claim:card.claim}),key,async(_,init)=>{assert.equal(JSON.parse(init.body).input,card.claim);return upstream(lesson);});assert.equal(Object.hasOwn(await without.json(),'brief'),false);
});

test('valid long Unicode context fits generation request limits',async()=>{
 const large={topic:'海'.repeat(120),grade:'海'.repeat(40),subject:'海'.repeat(60),learningGoal:'海'.repeat(500),observedBeliefs:'海'.repeat(1600),includeQuickChecks:false};
 const response=await handleAPI(req('lessons',{claim:'海'.repeat(600),brief:large,experimentRequest:'海'.repeat(1600)}),key,async()=>upstream(starter.lesson));
 assert.equal(response.status,200);
});

test('shared validators reject malformed planner structures and enforce explicit field bounds',async()=>{
 const {validateBrief,validatePlan,validateBriefImport}=await import('../public/planner-schema.js');
 assert.equal(validateBrief(brief),true);assert.equal(validatePlan(plan),true);assert.equal(validateBriefImport(imported),true);
 for(const value of [null,[],{...brief,topic:' '},{...brief,grade:'x'.repeat(41)},{...brief,subject:'x'.repeat(61)},{...brief,learningGoal:'x'.repeat(501)}])assert.equal(validateBrief(value),false);
 for(const value of [{...plan,cards:[]},{...plan,cards:Array(6).fill(card)},{...plan,cards:[{...card,experiment:''}]},{...plan,cards:[{...card,variable:'x'.repeat(101)}]}])assert.equal(validatePlan(value),false);
 assert.equal(validateBriefImport({...imported,uncertainty:''}),false);
});
