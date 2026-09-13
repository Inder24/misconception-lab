import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLiveRequest} from '../server/live.mjs';
import {createLiveProtocol, safeLabState} from '../public/live-protocol.js';
import {createLivePartner} from '../public/live-client.js';

const state = () => ({lessonId:'lesson-a',version:1,phase:'predict',controls:[{id:'mass',value:2,min:1,max:10,step:1}],results:null});
const request = (path, body, user='alice', origin='http://localhost:3000') => new Request(`http://localhost:3000${path}`, {method:'POST',headers:{'content-type':'application/json','origin':origin,...(user?{'oai-authenticated-user-id':user}:{})},body:JSON.stringify(body)});
const env={OPENAI_API_KEY:'test-key-never-sent-to-a-real-service'};

test('Live session creation keeps configuration trusted and scopes hangup to its authenticated owner', async()=>{
 const calls=[];
 const external=async(url,options)=>{calls.push({url,body:options.body?JSON.parse(options.body):null});return url.endsWith('/hangup')?new Response(null,{status:204}):Response.json({session:{id:'live_opaque-123'},transport:{type:'webrtc',sdp:'v=0\r\nanswer'}});};
 const response=await handleLiveRequest(request('/api/live/session',{sdp:'v=0\r\noffer',state:state(),session:{model:'attacker'}}),env,external);
 assert.equal(response.status,201);
 const body=await response.json();
 assert.equal(body.transport.sdp,'v=0\r\nanswer');
 assert.equal(calls[0].url,'https://api.openai.com/v1/live/sessions');
 assert.equal(calls[0].body.session.model,'gpt-live-1');
 assert.equal(calls[0].body.session.delegation.type,'responses');
 assert.equal(JSON.stringify(body).includes(env.OPENAI_API_KEY),false);
 assert.equal((await handleLiveRequest(request('/api/live/stop',{token:body.token},'bob'),env,external)).status,403);
 assert.equal((await handleLiveRequest(request('/api/live/stop',{token:`${body.token}x`}),env,external)).status,403);
 assert.equal(calls.length,1);
 assert.equal((await handleLiveRequest(request('/api/live/stop',{token:body.token}),env,external)).status,200);
 assert.equal(calls[1].url,'https://api.openai.com/v1/live/sessions/live_opaque-123/hangup');
});

test('Live routes reject missing identity, cross-origin, oversized input, and unconfigured credentials before upstream work',async()=>{
 const noNetwork=()=>assert.fail('Unexpected upstream request');
 assert.equal(await handleLiveRequest(new Request('http://localhost:3000/api/tutor'),env,noNetwork),null);
 assert.equal((await handleLiveRequest(request('/api/live/session',{sdp:'offer'},null),env,noNetwork)).status,401);
 assert.equal((await handleLiveRequest(request('/api/live/session',{sdp:'offer'},'alice','https://other.example'),env,noNetwork)).status,403);
 assert.equal((await handleLiveRequest(request('/api/live/session',{sdp:'x'.repeat(66000)}),env,noNetwork)).status,400);
 assert.equal((await handleLiveRequest(request('/api/live/session',{sdp:'v=0\r\noffer',state:state()}),{},noNetwork)).status,503);
});

test('state passed to Live cannot leak hidden answers or generated code',()=>{
 const snapshot=safeLabState({...state(),correctIndex:2,code:'secret',results:{metrics:[{label:'answer',value:'hidden'}],summary:'hidden'},prediction:{correctIndex:2,feedback:['secret']}});
 assert.equal(snapshot.results,null);
 assert.equal(JSON.stringify(snapshot).includes('secret'),false);
 assert.equal(JSON.stringify(snapshot).includes('hidden'),false);
});

test('voice can read prediction choices and record a bounded learner prediction without learning the answer',async()=>{
 const current={...state(),predictionQuestion:{prompt:'Which falls first?',options:['Light object','Heavy object','Together'],correctIndex:2},params:{mass:3}};
 const safe=safeLabState(current);
 assert.deepEqual(safe.predictionQuestion,{prompt:'Which falls first?',options:['Light object','Heavy object','Together']});
 assert.equal(safe.controls[0].value,3);
 const actions=[],messages=[];
 const protocol=createLiveProtocol({getState:()=>current,onTool:async(name,args)=>{actions.push({name,args});return {ok:true,recorded:true};},send:e=>messages.push(e)});
 await protocol.handleEvent({type:'session.started'});
 await protocol.handleEvent(nested('response.created',{response:{id:'prediction_response'}}));
 for(const [id,selectedIndex]of [['invalid',9],['valid',2]])await protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:id,name:'record_prediction',arguments:JSON.stringify({lessonId:'lesson-a',version:1,selectedIndex,reason:'Gravity accelerates both equally',confidence:70})}}));
 await protocol.handleEvent(nested('response.completed',{response:{id:'prediction_response'}}));
 assert.equal(actions.length,1);assert.equal(actions[0].name,'record_prediction');
 assert.equal(actions[0].args.selectedIndex,2);
 assert.equal(JSON.parse(messages.find(e=>e.item?.call_id==='invalid').item.output).ok,false);
 protocol.close();
});

const nested=(type,extra={})=>({type:'response.event',delegation_id:'delegation-1',event:{type,...extra}});
test('Responses function results come from finished items, all return before one continuation, and duplicate calls cannot repeat actions',async()=>{
 const messages=[],actions=[];
 const protocol=createLiveProtocol({getState:state,onTool:async(name,args)=>{actions.push(name);return {ok:true,value:args.value};},send:e=>messages.push(e)});
 await protocol.handleEvent({type:'session.started',session:{id:'live_1'}});
 messages.length=0;
 await protocol.handleEvent(nested('response.created',{response:{id:'resp_1',output:[]}}));
 await protocol.handleEvent(nested('response.function_call_arguments.done',{arguments:'{}'}));
 const call={type:'function_call',call_id:'call_1',name:'set_control',arguments:JSON.stringify({lessonId:'lesson-a',version:1,controlId:'mass',value:4})};
 await protocol.handleEvent(nested('response.output_item.done',{item:call}));
 await protocol.handleEvent(nested('response.output_item.done',{item:call}));
 await protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:'call_read',name:'read_lab',arguments:'{}'}}));
 assert.equal(messages.filter(e=>e.type==='response.create').length,0);
 await protocol.handleEvent(nested('response.completed',{response:{id:'resp_1',output:[]}}));
 assert.deepEqual(actions,['set_control']);
 const result=messages.find(e=>e.type==='response.item.create');
 assert.equal(JSON.parse(result.item.output).ok,true);
 assert.equal(result.item.call_id,'call_1');
 assert.equal(messages.at(-1).type,'response.create');
 assert.equal(messages.filter(e=>e.type==='response.create').length,1);
 assert.equal(messages.filter(e=>e.type==='response.item.create').length,2);
 protocol.close();
});

test('stale or invalid tool requests never mutate the lab and late results cannot report success for a new version',async()=>{
 let current=state(),resolveTool,signal;
 const messages=[],actions=[];
 const protocol=createLiveProtocol({getState:()=>current,onTool:async(name,args,context)=>{actions.push(name);signal=context.signal;return new Promise(resolve=>resolveTool=resolve);},send:e=>messages.push(e)});
 await protocol.handleEvent({type:'session.started'});
 await protocol.handleEvent(nested('response.created',{response:{id:'resp_1'}}));
 await protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:'bad',name:'set_control',arguments:JSON.stringify({lessonId:'old',version:1,controlId:'mass',value:4})}}));
 await protocol.handleEvent(nested('response.completed',{response:{id:'resp_1'}}));
 assert.equal(actions.length,0);
 assert.equal(JSON.parse(messages.find(e=>e.item?.call_id==='bad').item.output).ok,false);
 await protocol.handleEvent(nested('response.created',{response:{id:'resp_2'}}));
 const running=protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:'late',name:'run_experiment',arguments:JSON.stringify({lessonId:'lesson-a',version:1})}}));
 await new Promise(resolve=>setImmediate(resolve));
 current={...current,version:2};protocol.sync();
 assert.equal(signal.aborted,true);
 resolveTool({ok:true,summary:'old outcome'});await running;
 await protocol.handleEvent(nested('response.completed',{response:{id:'resp_2'}}));
 assert.equal(JSON.parse(messages.find(e=>e.item?.call_id==='late').item.output).ok,false);
 assert.equal(JSON.stringify(messages).includes('old outcome'),false);
 protocol.close();
});

test('overlapping transcript fragments preserve text and time and do not masquerade as completed turns',async()=>{
 const fragments=[];
 const protocol=createLiveProtocol({getState:state,onTool:()=>assert.fail('Transcript must not trigger tools'),send:()=>{},onTranscript:e=>fragments.push(e)});
 await protocol.handleEvent({type:'session.started'});
 await protocol.handleEvent({type:'session.input_transcript.delta',event_id:'in1',delta:'What is',start_ms:0,end_ms:400});
 await protocol.handleEvent({type:'session.output_transcript.delta',event_id:'out1',delta:'Sure',start_ms:200,end_ms:500});
 await protocol.handleEvent({type:'session.input_transcript.delta',event_id:'in2',delta:' mass?',start_ms:400,end_ms:800});
 assert.deepEqual(fragments.map(({role,text,startMs,endMs,final})=>({role,text,startMs,endMs,final})),[
  {role:'user',text:'What is',startMs:0,endMs:400,final:false},{role:'assistant',text:'Sure',startMs:200,endMs:500,final:false},{role:'user',text:' mass?',startMs:400,endMs:800,final:false}
 ]);
 protocol.close();
});

class FakeChannel extends EventTarget{
 readyState='open';sent=[];
 send(data){this.sent.push(JSON.parse(data));if(JSON.parse(data).type==='session.close')queueMicrotask(()=>this.emit({type:'session.closed',reason:'close_requested',usage:{seconds:1}}));}
 emit(data){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));}
 close(){this.readyState='closed';this.dispatchEvent(new Event('close'));}
}
function mediaBoundary({getUserMedia,fetcher}={}){
 const track={stopped:false,stop(){this.stopped=true;}},stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 const peers=[],audios=[],http=[];
 class Peer extends EventTarget{
  constructor(){super();peers.push(this);this.iceGatheringState='complete';this.connectionState='new';this.channel=new FakeChannel();}
  addTrack(){} createDataChannel(label){assert.equal(label,'oai-events');return this.channel;}
  async createOffer(){return {type:'offer',sdp:'v=0\r\noffer'};} async setLocalDescription(value){this.localDescription=value;}
  async setRemoteDescription(value){this.remoteDescription=value;queueMicrotask(()=>this.channel.emit({type:'session.started',session:{id:'live_1'}}));}
  close(){this.connectionState='closed';}
 }
 class Audio {constructor(){audios.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}remove(){}}
 const runtime={RTCPeerConnection:Peer,Audio,MediaStream:class{constructor(tracks){this.tracks=tracks;}getTracks(){return this.tracks;}},navigator:{mediaDevices:{getUserMedia:getUserMedia||(()=>Promise.resolve(stream))}},fetch:async(url,options)=>{http.push({url,options});return fetcher?fetcher(url,options):Response.json(url.endsWith('/stop')?{stopped:true}:{session:{id:'live_1'},transport:{type:'webrtc',sdp:'v=0\r\nanswer'},token:'owned-token'});},addEventListener(){},removeEventListener(){}};
 return {runtime,track,stream,peers,audios,http};
}
test('browser startup waits for session.started and graceful stop releases media and closes the peer',async()=>{
 const boundary=mediaBoundary(),statuses=[];
 const live=createLivePartner({getState:state,onTool:async()=>({ok:true}),onStatus:s=>statuses.push(s)},boundary.runtime);
 await live.start();
 assert.equal(statuses.at(-1).state,'connected');
 assert.equal(statuses.at(-1).microphone,true);
 boundary.peers[0].channel.emit({type:'error',error:{message:'A context update was rejected'}});
 assert.equal(statuses.at(-1).state,'error');
 assert.equal(statuses.at(-1).microphone,true);
 assert.equal(boundary.peers[0].remoteDescription.sdp,'v=0\r\nanswer');
 assert.equal(boundary.peers[0].channel.sent.some(e=>e.type==='session.start'),false);
 live.sync();await live.stop();
 assert.equal(boundary.track.stopped,true);
 assert.equal(boundary.peers[0].connectionState,'closed');
 assert.equal(boundary.peers[0].channel.sent.at(-1).type,'session.close');
 assert.equal(statuses.at(-1).state,'stopped');
 assert.equal(statuses.at(-1).microphone,false);
});
test('stopping before microphone permission resolves never opens a network session and stops late media',async()=>{
 let grant;const boundary=mediaBoundary({getUserMedia:()=>new Promise(resolve=>grant=resolve)}),statuses=[];
 const live=createLivePartner({getState:state,onTool:async()=>({ok:true}),onStatus:s=>statuses.push(s)},boundary.runtime);
 const starting=live.start();await live.stop();grant(boundary.stream);await starting;
 assert.equal(boundary.track.stopped,true);assert.equal(boundary.http.length,0);
 assert.equal(statuses.at(-1).state,'stopped');
});
test('microphone denial is visible and cannot leave active capture or a peer',async()=>{
 const boundary=mediaBoundary({getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError');}}),statuses=[];
 const live=createLivePartner({getState:state,onTool:async()=>({ok:true}),onStatus:s=>statuses.push(s)},boundary.runtime);
 await live.start();
 assert.equal(statuses.at(-1).state,'permission-denied');
 assert.equal(boundary.http.length,0);
 assert.equal(boundary.peers.every(p=>p.connectionState==='closed'),true);
});
test('stop during SDP exchange hangs up a late owned server session and never installs its answer',async()=>{
 let answer;const boundary=mediaBoundary({fetcher:async url=>url.endsWith('/session')?new Promise(resolve=>answer=resolve):Response.json({stopped:true})});
 const live=createLivePartner({getState:state,onTool:async()=>({ok:true})},boundary.runtime);
 const starting=live.start();await new Promise(resolve=>setImmediate(resolve));await live.stop();
 answer(Response.json({session:{id:'late'},transport:{type:'webrtc',sdp:'v=0\r\nlate'},token:'late-owner-token'}));await starting;
 assert.equal(boundary.peers[0].remoteDescription,undefined);
 assert.equal(boundary.track.stopped,true);
 assert.equal(boundary.http[1].url,'/api/live/stop');
 assert.equal(JSON.parse(boundary.http[1].options.body).token,'late-owner-token');
});

test('a lost peer connection immediately stops capture and terminates only the owned server session',async()=>{
 const boundary=mediaBoundary(),statuses=[];
 const live=createLivePartner({getState:state,onTool:async()=>({ok:true}),onStatus:s=>statuses.push(s)},boundary.runtime);
 await live.start();
 boundary.peers[0].connectionState='failed';boundary.peers[0].dispatchEvent(new Event('connectionstatechange'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(boundary.track.stopped,true);
 assert.equal(boundary.peers[0].connectionState,'closed');
 assert.equal(boundary.http[1].url,'/api/live/stop');
 assert.equal(statuses.at(-1).state,'disconnected');
});

test('server hangs up a session created after its browser request was cancelled',async()=>{
 const abort=new AbortController(),urls=[];
 const req=new Request(request('/api/live/session',{sdp:'v=0\r\noffer',state:state()}),{signal:abort.signal});
 const response=await handleLiveRequest(req,env,async url=>{
  urls.push(url);
  if(url.endsWith('/hangup'))return new Response(null,{status:204});
  abort.abort();return Response.json({session:{id:'live_cancelled'},transport:{type:'webrtc',sdp:'v=0\r\nanswer'}});
 });
 assert.equal(response.status,499);
 assert.deepEqual(urls,['https://api.openai.com/v1/live/sessions','https://api.openai.com/v1/live/sessions/live_cancelled/hangup']);
});

test('unknown tools and invalid control values return failures without entering the application',async()=>{
 const messages=[],actions=[],protocol=createLiveProtocol({getState:state,onTool:()=>{actions.push('executed');return {ok:true};},send:e=>messages.push(e)});
 await protocol.handleEvent({type:'session.started'});
 await protocol.handleEvent(nested('response.created',{response:{id:'invalid_response'}}));
 const fixtures=[['unsupported',{}],['set_control',{lessonId:'lesson-a',version:1,controlId:'mass',value:99}],['set_control',{lessonId:'lesson-a',version:1,controlId:'mass',value:2.5}],['set_control',{lessonId:'lesson-a',version:1,controlId:'mass',value:4,extra:'ignored?'}]];
 for(const [index,[name,args]]of fixtures.entries())await protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:`invalid_${index}`,name,arguments:JSON.stringify(args)}}));
 await protocol.handleEvent(nested('response.completed',{response:{id:'invalid_response'}}));
 const results=messages.filter(e=>e.type==='response.item.create');assert.equal(results.length,4);
 assert.equal(results.every(e=>JSON.parse(e.item.output).ok===false),true);
 assert.deepEqual(actions,[]);
 protocol.close();
});

test('application tools cannot execute before the Live session has started',async()=>{
 const actions=[];
 const protocol=createLiveProtocol({getState:state,onTool:()=>{actions.push('executed');return {ok:true};},send:()=>assert.fail('Cannot send before startup')});
 await protocol.handleEvent(nested('response.created',{response:{id:'early'}}));
 await protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:'early-call',name:'set_control',arguments:JSON.stringify({lessonId:'lesson-a',version:1,controlId:'mass',value:4})}}));
 assert.deepEqual(actions,[]);
 protocol.close();
});

test('a voice revision can acknowledge its committed new identity without aborting itself during UI sync',async()=>{
 let current=state(),protocol;
 const messages=[];
 protocol=createLiveProtocol({getState:()=>current,onTool:async(name,args,{signal})=>{
  current={...current,lessonId:'lesson-revised',version:2};protocol.sync();
  await Promise.resolve();signal.throwIfAborted();
  return {ok:true,lessonId:'lesson-revised',version:2};
 },send:e=>messages.push(e)});
 await protocol.handleEvent({type:'session.started'});
 await protocol.handleEvent(nested('response.created',{response:{id:'revision'}}));
 await protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:'revision-call',name:'revise_experiment',arguments:JSON.stringify({lessonId:'lesson-a',version:1,request:'Add a drag coefficient control'})}}));
 await protocol.handleEvent(nested('response.completed',{response:{id:'revision'}}));
 assert.equal(JSON.parse(messages.find(e=>e.item?.call_id==='revision-call').item.output).ok,true);
 protocol.close();
});

test('read_lab keeps a pinned baseline attributable to its old identity without exposing lesson code',()=>{
 const safe=safeLabState({...state(),pinned:{lessonId:'original',version:1,title:'Previous experiment',params:{mass:4},lesson:{code:'hidden'},results:{metrics:[{label:'time',value:'2 seconds'}],summary:'Both landed together'}}});
 assert.equal(safe.pinned.lessonId,'original');assert.equal(safe.pinned.results.summary,'Both landed together');
 assert.equal(JSON.stringify(safe).includes('hidden'),false);
 assert.equal(safe.results,null);
});

test('an unrelated lesson switch still aborts a pending voice revision and suppresses its late result',async()=>{
 let current=state(),resolveRevision,revisionSignal;
 const messages=[],protocol=createLiveProtocol({getState:()=>current,onTool:async(name,args,{signal})=>{revisionSignal=signal;return new Promise(resolve=>resolveRevision=resolve);},send:e=>messages.push(e)});
 await protocol.handleEvent({type:'session.started'});
 await protocol.handleEvent(nested('response.created',{response:{id:'pending-revision'}}));
 const running=protocol.handleEvent(nested('response.output_item.done',{item:{type:'function_call',call_id:'stale-revision-call',name:'revise_experiment',arguments:JSON.stringify({lessonId:'lesson-a',version:1,request:'Change to a larger falling object'})}}));
 await new Promise(resolve=>setImmediate(resolve));
 current={...current,lessonId:'user-selected-other-lesson',version:1};protocol.sync();
 await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(revisionSignal.aborted,true);
 resolveRevision({ok:true,lessonId:'obsolete-revision',version:2,summary:'stale details'});await running;
 await protocol.handleEvent(nested('response.completed',{response:{id:'pending-revision'}}));
 assert.equal(JSON.parse(messages.find(e=>e.item?.call_id==='stale-revision-call').item.output).ok,false);
 assert.equal(JSON.stringify(messages).includes('stale details'),false);
 protocol.close();
});
