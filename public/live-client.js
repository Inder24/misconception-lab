import {createLiveProtocol,safeLabState} from './live-protocol.js';

// External browser APIs are injectable so media and network lifecycle can be tested without a paid call.
export function createLivePartner({getState,onTool,onStatus=()=>{},onTranscript=()=>{},audioElement},platform=globalThis){
 let active=null,serial=0;
 let guestId;
 const status=(state,message,extra={})=>onStatus({state,message,microphone:Boolean(active?.microphone&&!active.stopping),...extra});
 const alive=attempt=>active===attempt&&!attempt.stopping;
 function getGuestId(){
  if(guestId)return guestId;
  const storageKey='misconception-lab-guest-id';
  try{
   const saved=platform.localStorage?.getItem(storageKey);
   if(/^[a-z0-9][a-z0-9-]{15,79}$/i.test(saved||''))return guestId=saved;
  }catch{}
  const generated=platform.crypto?.randomUUID?.()||`guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,14)}`;
  guestId=generated;
  try{platform.localStorage?.setItem(storageKey,guestId);}catch{}
  return guestId;
 }
 const requestHeaders=()=>({'content-type':'application/json','x-misconception-lab-guest':getGuestId()});
 function releaseMedia(attempt){
  attempt.microphone?.getTracks().forEach(track=>track.stop());
  attempt.audio?.pause();
  if(attempt.audio?.srcObject)attempt.audio.srcObject.getTracks?.().forEach(track=>track.stop());
  if(attempt.audio)attempt.audio.srcObject=null;
 }
 function cleanup(attempt){
  clearTimeout(attempt.connectTimer);clearTimeout(attempt.closeTimer);
  attempt.controller.abort();attempt.protocol?.close();releaseMedia(attempt);
  attempt.channel?.close();attempt.peer?.close();
  platform.removeEventListener?.('pagehide',attempt.pagehide);
  if(active===attempt)active=null;
 }
 async function serverStop(attempt){
  if(!attempt.token)return false;
  if(attempt.hangup)return attempt.hangup;
  attempt.hangup=(async()=>{
   try{
   const response=await platform.fetch('/api/live/stop',{method:'POST',headers:requestHeaders(),body:JSON.stringify({token:attempt.token}),keepalive:true,signal:AbortSignal.timeout(15000)});
    return response.ok;
   }catch{return false;}
  })();
  return attempt.hangup;
 }
 async function end(attempt,{disconnected=false,quiet=false}={}){
  if(attempt.ending)return attempt.ending;
  attempt.stopping=true;attempt.controller.abort();attempt.protocol?.close();releaseMedia(attempt);
  attempt.resolveStart?.();
  if(!quiet)status('stopping','Stopping microphone and voice…');
  attempt.ending=(async()=>{
   let finalized=attempt.finalized;
   if(!finalized&&attempt.ready&&attempt.channel?.readyState==='open'&&!disconnected){
    const drained=new Promise(resolve=>{attempt.resolveClosed=resolve;attempt.closeTimer=setTimeout(()=>resolve(false),1800);});
    attempt.channel.send(JSON.stringify({type:'session.close',event_id:`close_${attempt.id}`}));
    finalized=await drained;
   }
   // The signed server handle permits only this browser's session to be ended.
   const confirmed=finalized||await serverStop(attempt);
   cleanup(attempt);
   if(!quiet)status(disconnected?'disconnected':'stopped',confirmed||!attempt.token?(disconnected?'Voice disconnected. Microphone is off.':'Voice stopped. Microphone is off.'):'Microphone is off. Server session finalization could not be confirmed.',{finalized:Boolean(finalized),usage:attempt.usage});
  })();
  return attempt.ending;
 }
 async function waitForIce(attempt){
  if(attempt.peer.iceGatheringState==='complete')return;
  await new Promise((resolve,reject)=>{
   const done=()=>{if(attempt.peer.iceGatheringState==='complete'){dispose();resolve();}};
   const abort=()=>{dispose();reject(new DOMException('Voice startup cancelled.','AbortError'));};
   const timeout=setTimeout(()=>{dispose();reject(new Error('Could not gather a WebRTC connection. Check your network.'));},10000);
   const dispose=()=>{clearTimeout(timeout);attempt.peer.removeEventListener('icegatheringstatechange',done);attempt.controller.signal.removeEventListener('abort',abort);};
   attempt.peer.addEventListener('icegatheringstatechange',done);attempt.controller.signal.addEventListener('abort',abort,{once:true});done();
  });
 }
 async function start(){
  if(active){
   if(active.stopping)return active.ending;
   if(active.ready){try{await active.audio?.play();status('connected','Listening. Microphone is on.');}catch{status('playback-blocked','Use the audio play control to hear the tutor.');}}
   return;
  }
  if(!platform.navigator?.mediaDevices?.getUserMedia||!platform.RTCPeerConnection){status('error','Voice needs a supported browser on HTTPS or localhost.');return;}
  const attempt={id:++serial,controller:new AbortController(),ready:false,stopping:false,finalized:false};active=attempt;
  attempt.pagehide=()=>{void end(attempt,{disconnected:true,quiet:true});};platform.addEventListener?.('pagehide',attempt.pagehide);
  const started=new Promise(resolve=>attempt.resolveStart=resolve);
  try{
   status('requesting-microphone','Allow microphone access to speak with the AI tutor.');
   attempt.microphone=await platform.navigator.mediaDevices.getUserMedia({audio:true});
   if(!alive(attempt)){releaseMedia(attempt);return;}
   attempt.peer=new platform.RTCPeerConnection();
   attempt.audio=audioElement||new platform.Audio();attempt.audio.autoplay=true;attempt.audio.controls=true;
   attempt.peer.addEventListener('track',event=>{
    if(!alive(attempt)){event.track.stop();return;}
    attempt.audio.srcObject=event.streams?.[0]||new platform.MediaStream([event.track]);
    attempt.audio.play().catch(()=>{if(alive(attempt))status('playback-blocked','Audio playback is blocked. Use the audio play control or select Start voice again.',{audioElement:attempt.audio});});
   });
   for(const track of attempt.microphone.getAudioTracks())attempt.peer.addTrack(track,attempt.microphone);
   attempt.channel=attempt.peer.createDataChannel('oai-events');
   attempt.protocol=createLiveProtocol({getState,onTool,onStatus:value=>{if(alive(attempt))onStatus({...value,microphone:Boolean(attempt.microphone)});},onTranscript,send:event=>{if(alive(attempt)&&attempt.channel.readyState==='open')attempt.channel.send(JSON.stringify(event));}});
   attempt.channel.addEventListener('message',({data})=>{
    let event;try{event=JSON.parse(data);}catch{if(alive(attempt))status('error','Voice sent an unreadable event.');return;}
    if(event.type==='session.closed'){
     attempt.finalized=true;attempt.usage=event.usage;attempt.resolveClosed?.(true);
     if(!attempt.stopping)void end(attempt);
     return;
    }
    if(!alive(attempt))return;
    if(event.type==='session.started'){
     attempt.ready=true;clearTimeout(attempt.connectTimer);status('connected','Listening. Microphone is on.');attempt.resolveStart();
    }
    void attempt.protocol.handleEvent(event).catch(()=>{if(alive(attempt))status('error','The voice action could not be processed.');});
   });
   attempt.channel.addEventListener('close',()=>{if(alive(attempt))void end(attempt,{disconnected:true});});
   attempt.channel.addEventListener('error',()=>{if(alive(attempt))void end(attempt,{disconnected:true});});
   attempt.peer.addEventListener('connectionstatechange',()=>{if(alive(attempt)&&['failed','disconnected','closed'].includes(attempt.peer.connectionState))void end(attempt,{disconnected:true});});
   status('connecting','Connecting to GPT-Live-1…');
   await attempt.peer.setLocalDescription(await attempt.peer.createOffer());
   if(!alive(attempt))return;
   await waitForIce(attempt);if(!alive(attempt))return;
   // Keep the bounded HTTP exchange alive on Stop so a late session gets its owned hangup handle.
   const response=await platform.fetch('/api/live/session',{method:'POST',headers:requestHeaders(),body:JSON.stringify({sdp:attempt.peer.localDescription.sdp,state:safeLabState(getState())}),signal:AbortSignal.timeout(40000)});
   let result;try{result=await response.json();}catch{throw new Error('Voice server returned an unreadable response.');}
   if(!response.ok)throw new Error(result.error||'Voice could not connect.');
   attempt.token=result.token;
   if(!alive(attempt)){await serverStop(attempt);return;}
   if(typeof attempt.token!=='string'||typeof result.transport?.sdp!=='string'||result.transport.type!=='webrtc')throw new Error('Voice server returned an invalid connection.');
   attempt.connectTimer=setTimeout(()=>{if(alive(attempt)){void end(attempt,{quiet:true}).then(()=>status('error','Voice did not start. Microphone is off. Check your network and try again.'));attempt.resolveStart();}},15000);
   await attempt.peer.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
   await started;
  }catch(error){
   if(!alive(attempt))return;
   await end(attempt,{quiet:true});
   status(error.name==='NotAllowedError'?'permission-denied':'error',error.name==='NotAllowedError'?'Microphone access was denied. Allow it in your browser settings and start voice again.':error.name==='NotFoundError'?'No microphone was found. Connect one and start voice again.':error.name==='TimeoutError'?'Voice connection timed out. Microphone is off.':error.message||'Voice could not connect. Microphone is off.');
  }
 }
 function stop(){return active?end(active):Promise.resolve();}
 function sync(){active?.protocol?.sync();}
 return {start,stop,sync};
}
