import {validateExperimentResult} from './experiment-checks.js';
const aborted=()=>new DOMException('Experiment canceled.','AbortError');
export class SandboxExperiment{
 #container;#title;#frame=null;#nonce='';#pending=new Map();#sequence=0;#ready=false;#tail=Promise.resolve();#listener;
 constructor(container,{title='Interactive experiment visualization'}={}){
  if(!container?.append)throw Error('A sandbox container is required.');this.#container=container;this.#title=title;
  this.#listener=event=>{
   if(event.source!==this.#frame?.contentWindow||event.data?.nonce!==this.#nonce)return;
   const data=event.data;
   if(data.type==='error'){
    const error=Error(typeof data.message==='string'?data.message.slice(0,600):'Sandbox execution failed.');this.#close(error);return;
   }
   const id=data.type==='ready'?'load':data.requestId;
   const pending=this.#pending.get(id);if(!pending)return;
   if(data.type==='ready'){this.#ready=true;pending.resolve();}
   if(data.type==='result'){
    try{const result={marks:data.marks,metrics:data.metrics,summary:data.summary};validateExperimentResult(result);pending.resolve(result);}catch(error){this.#close(error);}
   }
  };
  globalThis.addEventListener('message',this.#listener);
 }
 #request(id,send,timeout,signal){
  return new Promise((resolve,reject)=>{
   if(signal?.aborted){reject(signal.reason||aborted());return;}
   let timer;const abort=()=>this.#close(signal.reason||aborted());
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);this.#pending.delete(id);};
   this.#pending.set(id,{resolve:value=>{cleanup();resolve(value);},reject:error=>{cleanup();reject(error);}});
   signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>this.#close(Error('The experiment timed out; its worker was terminated.')),timeout);
   try{send();}catch(error){this.#close(error);}
  });
 }
 #close(error){
  this.#ready=false;
  if(this.#frame){this.#frame.contentWindow?.postMessage({type:'destroy',nonce:this.#nonce},'*');this.#frame.remove();this.#frame=null;}
  for(const pending of [...this.#pending.values()])pending.reject(error);
 }
 async load(code,{signal}={}){
  this.#close(aborted());this.#tail=Promise.resolve();
  if(typeof code!=='string'||!code.trim()||code.length>16000)throw Error('Experiment code must contain 1–16000 characters.');
  if(signal?.aborted)throw signal.reason||aborted();
  this.#nonce=crypto.randomUUID();const frame=document.createElement('iframe');this.#frame=frame;
  frame.title=this.#title;frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';frame.src='/experiment-frame.html';frame.style.cssText='display:block;border:0;width:100%;height:340px';
  return this.#request('load',()=>{
   frame.addEventListener('load',()=>{if(this.#frame===frame)frame.contentWindow.postMessage({type:'init',nonce:this.#nonce,code},'*');},{once:true});
   this.#container.append(frame);
  },5000,signal);
 }
 run(params,viewport={}, {signal}={}){
  const nonce=this.#nonce;
  const execute=()=>{
   if(signal?.aborted)throw signal.reason||aborted();
   if(!this.#ready||!this.#frame||nonce!==this.#nonce)throw Error('The sandbox is not ready. Load the experiment again.');
   if(!params||typeof params!=='object'||Array.isArray(params)||Object.values(params).some(v=>!Number.isFinite(v)))throw Error('Experiment parameters must be finite numbers.');
   const view={width:viewport.width??Math.max(320,Math.round(this.#container.getBoundingClientRect().width)),height:viewport.height??340,progress:viewport.progress??1};
   if(!Number.isFinite(view.width)||view.width<100||view.width>2000||!Number.isFinite(view.height)||view.height<100||view.height>1000||!Number.isFinite(view.progress)||view.progress<0||view.progress>1)throw Error('Invalid experiment viewport.');
   this.#frame.style.height=view.height+'px';
   const requestId=++this.#sequence;
   return this.#request(requestId,()=>this.#frame.contentWindow.postMessage({type:'render',nonce,requestId,params,viewport:view},'*'),2500,signal);
  };
  const run=this.#tail.then(execute);this.#tail=run.catch(()=>{});return run;
 }
 destroy(){this.#close(aborted());globalThis.removeEventListener('message',this.#listener);}
}
