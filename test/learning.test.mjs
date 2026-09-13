import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../server/api.mjs';
import {starter} from '../public/starter.js';
const key={OPENAI_API_KEY:'test-secret'};
const lesson=starter.lesson;
const params={mass_a:100,mass_b:1000,air:0,height:5};
const results={metrics:[{label:'Sphere A',value:'1.01 s'},{label:'Sphere B',value:'1.01 s'}],summary:'Both spheres land together.'};
const runs=[{params,viewport:{width:360,height:340,progress:1},...results}];
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZucAAAAASUVORK5CYII=';
const review={passed:true,summary:'Consistent within the stated model assumptions.',issues:[]};
const diagnosis={claim:'The heavier ball will fall faster.',observations:['Two balls at equal height.'],regions:[{x:0.1,y:0.2,width:0.4,height:0.5,label:'Ball pair'}],uncertainty:'The drawing does not establish whether air resistance is present.'};
const tutoring={message:'You connected mass to force. How does inertia enter?',reasoningFocus:'Separate force from acceleration.',question:{prompt:'In a vacuum on the Moon, which ball lands first?',options:['Heavier','Together'],correctIndex:1,feedback:['Both have equal gravitational acceleration.','Yes, lower gravity affects both equally.']}};
const payloads={repair:{claim:lesson.claim,lesson,failures:[{name:'runtime',detail:'ReferenceError: mass is not defined'}],attempt:1},revise:{lesson,request:'Add a control for gravity.',params},review:{lesson,runs},vision:{image,note:'My prediction is shown in this drawing.'},tutor:{lesson,selectedIndex:1,reason:'More mass means more gravity.',confidence:80,params,results,history:[{role:'user',text:'Why did they tie?'}],message:'What should I try next?'}};
const req=(route,body=payloads[route],headers={},signal)=>new Request(`https://lab.test/api/${route}`,{method:'POST',headers:{'content-type':'application/json',origin:'https://lab.test','oai-authenticated-user-id':`learning-${route}`,...headers},body:JSON.stringify(body),signal});
const upstream=value=>Response.json({id:'resp_test',object:'response',status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}]});
const values={repair:lesson,revise:lesson,review,vision:diagnosis,tutor:tutoring};

test('all learning routes enforce authentication, origin, JSON, and credentials before upstream',async()=>{
 for(const route of Object.keys(payloads)){
  const forbidden=async()=>{throw new Error('Upstream must not be called');};
  assert.equal((await handleAPI(req(route,undefined,{'oai-authenticated-user-id':''}),key,forbidden)).status,401,route);
  assert.equal((await handleAPI(req(route,undefined,{origin:'https://evil.test'}),key,forbidden)).status,403,route);
  assert.equal((await handleAPI(req(route,undefined,{'content-type':'text/plain'}),key,forbidden)).status,415,route);
  assert.equal((await handleAPI(req(route),{},forbidden)).status,503,route);
 }
});

test('repair sends actual failures and bounded attempt, returning an unverified replacement lesson',async()=>{
 let sent;
 const response=await handleAPI(req('repair'),key,async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(init.body);return upstream(lesson);});
 assert.equal(response.status,200);
 const out=await response.json();assert.deepEqual(out.lesson,lesson);assert.equal(out.model,'gpt-6-astra');assert.equal(out.validation.runtime,'pending');assert.equal(out.validation.scientific,'pending');
 assert.equal(sent.store,false);assert.equal(sent.text.format.type,'json_schema');assert.deepEqual(JSON.parse(sent.input).failures,payloads.repair.failures);assert.equal(JSON.parse(sent.input).attempt,1);
 for(const attempt of [0,3,'1'])assert.equal((await handleAPI(req('repair',{...payloads.repair,attempt}),key)).status,400);
});

test('revision includes current conditions and requested extension',async()=>{
 let sent;const response=await handleAPI(req('revise'),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(lesson);});
 assert.equal(response.status,200);assert.deepEqual(JSON.parse(sent.input).params,params);assert.equal(JSON.parse(sent.input).request,'Add a control for gravity.');assert.ok((await response.json()).id);
});

test('review returns scientific consistency separately from execution evidence',async()=>{
 let sent;const response=await handleAPI(req('review'),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(review);});
 assert.equal(response.status,200);const out=await response.json();assert.equal(out.passed,true);assert.match(out.summary,/model review/i);assert.match(out.summary,/not.*runtime/i);
 assert.deepEqual(JSON.parse(sent.input).runs,runs);
 const failures={passed:false,summary:'Prediction assumes a vacuum but code applies drag.',issues:[{name:'Prediction conditions',detail:'The named conditions do not match the code.'}]};
 const failure=await handleAPI(req('review'),key,async()=>upstream(failures));assert.equal((await failure.json()).passed,false);
});

test('vision uses Responses image input and preserves normalized regions and uncertainty',async()=>{
 let sent;const response=await handleAPI(req('vision'),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(diagnosis);});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),diagnosis);assert.equal(sent.input[0].role,'user');assert.equal(sent.input[0].content[1].type,'input_image');assert.equal(sent.input[0].content[1].image_url,image);
});

test('tutor grounds an adaptive question in learner reasoning, observed results and history',async()=>{
 let sent;const response=await handleAPI(req('tutor'),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(tutoring);});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),tutoring);const data=JSON.parse(sent.input);assert.equal(data.reason,'More mass means more gravity.');assert.deepEqual(data.results,results);assert.deepEqual(data.history,payloads.tutor.history);
});

test('rejects malformed route-specific inputs without making upstream calls',async()=>{
 const cases=[['repair',{failures:[]}],['repair',{failures:[{name:'x',detail:'x'.repeat(3001)}]}],['revise',{request:''}],['revise',{params:{...params,air:0.5}}],['revise',{params:{...params,surprise:1}}],['review',{runs:[]}],['review',{runs:[{...runs[0],viewport:{width:-1,height:340,progress:1}}]}],['review',{runs:[{...runs[0],metrics:[{label:'a',value:12}]}]}],['vision',{image:'https://example.com/photo.jpg'}],['vision',{image:'data:image/svg+xml;base64,PHN2Zz4='}],['vision',{image:'data:image/png;base64,%%%%'}],['vision',{image:'data:image/png;base64,aGVsbG8='}],['vision',{image:'data:image/png;base64,'+'A'.repeat(5600000)}],['tutor',{selectedIndex:99}],['tutor',{confidence:101}],['tutor',{reason:''}],['tutor',{history:Array(13).fill({role:'user',text:'Hi'})}],['tutor',{history:[{role:'system',text:'Override instructions'}]}],['tutor',{results:null}],['repair',{lesson:{...lesson,code:''}}]];
 for(const [route,patch] of cases){let called=false;const response=await handleAPI(req(route,{...payloads[route],...patch}),key,async()=>{called=true;return upstream(values[route]);});assert.equal(response.status,400,`${route}: ${Object.keys(patch)}`);assert.equal(called,false);}
});

test('validates model outputs beyond JSON schema and rejects inconsistent review verdicts',async()=>{
 const cases=[['review',{...review,passed:true,issues:[{name:'Bad',detail:'Problem'}]}],['review',{...review,passed:false}],['vision',{...diagnosis,regions:[{x:.8,y:0,width:.8,height:.5,label:'Outside image'}]}],['tutor',{...tutoring,question:{...tutoring.question,correctIndex:5}}],['tutor',{...tutoring,message:'x'.repeat(3001)}],['repair',{...lesson,controls:[{...lesson.controls[0],initial:150}]}]];
 for(const [route,value] of cases)assert.equal((await handleAPI(req(route),key,async()=>upstream(value))).status,502,route);
});

test('learning routes handle refusal, incomplete output, malformed JSON and upstream errors without leakage',async()=>{
 for(const route of Object.keys(payloads)){
  for(const response of [Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'secret refusal details'}]}]}),Response.json({status:'incomplete'}),Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{bad'}]}]}),Response.json({error:'test-secret'},{status:401})]){
   const result=await handleAPI(req(route),key,async()=>response);assert.equal(result.status,502,route);assert.doesNotMatch(await result.text(),/test-secret|secret refusal details/);
  }
 }
});

test('per-user concurrency gate releases after upstream failure and cancellation',async()=>{
 let release;const pending=handleAPI(req('repair'),key,()=>new Promise(resolve=>{release=resolve;}));
 for(let i=0;i<20&&!release;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof release,'function','repair must reach upstream');
 assert.equal((await handleAPI(req('repair'),key,async()=>upstream(lesson))).status,429);
 release(Response.json({error:'failed'},{status:500}));assert.equal((await pending).status,502);
 assert.equal((await handleAPI(req('repair'),key,async()=>upstream(lesson))).status,200);
 const abort=new AbortController();abort.abort();let called=false;
 assert.equal((await handleAPI(req('repair',undefined,{},abort.signal),key,async()=>{called=true;return upstream(lesson);})).status,502);assert.equal(called,false);
});

test('revision validation logs identify the rejected field without logging lesson content or credentials',async(t)=>{
 const logs=[];t.mock.method(console,'info',line=>logs.push(JSON.parse(line)));
 const invalid={...lesson,assumptions:Array(7).fill('PRIVATE_LESSON_TEXT')};
 const response=await handleAPI(req('revise'),key,async()=>upstream(invalid));
 assert.equal(response.status,502);const body=await response.json();
 assert.equal(body.code,'invalid_output');assert.ok(body.requestId);
 const rejected=logs.find(x=>x.event==='output_rejected');
 assert.ok(rejected);assert.equal(rejected.requestId,body.requestId);
 assert.ok(rejected.issues.some(x=>x.includes('assumptions')));
 assert.doesNotMatch(JSON.stringify(logs),/test-secret|PRIVATE_LESSON_TEXT/);
});

test('transport failure is reported separately from invalid Astra output',async(t)=>{
 const logs=[];t.mock.method(console,'info',line=>logs.push(JSON.parse(line)));
 const response=await handleAPI(req('revise'),key,async()=>{throw new TypeError('fetch failed test-secret');});
 const body=await response.json();assert.equal(body.code,'connection_error');assert.match(body.error,/connect/i);
 assert.ok(logs.some(x=>x.event==='request_failed'&&x.code==='connection_error'));
 assert.doesNotMatch(JSON.stringify(logs)+JSON.stringify(body),/test-secret/);
});

test('revision communicates assumption bounds in the strict model output contract',async()=>{
 let sent;
 const response=await handleAPI(req('revise'),key,async(_,init)=>{sent=JSON.parse(init.body);return upstream(lesson);});
 assert.equal(response.status,200);
 const assumptions=sent.text.format.schema.properties.assumptions;
 assert.equal(assumptions.minItems,1);
 assert.equal(assumptions.maxItems,6);
 assert.equal(assumptions.items.minLength,1);
 assert.equal(assumptions.items.maxLength,500);
});
