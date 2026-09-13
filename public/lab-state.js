import {validateControls,validateControlValue,validateExperimentResult} from './experiment-checks.js';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const snapshot=value=>freeze(structuredClone(value));
export class LabState{
 #envelope;#params;#prediction=null;#results=null;#viewport=null;#pinned=null;
 constructor(envelope){this.accept(envelope);}
 get envelope(){return this.#envelope;}get lesson(){return this.#envelope.lesson;}get version(){return this.#envelope.version;}
 get identity(){return {lessonId:this.#envelope.id,version:this.version};}
 get params(){return this.#params;}get prediction(){return this.#prediction;}get results(){return this.#results;}get pinned(){return this.#pinned;}
 get phase(){return this.#results?'explain':this.#prediction?'test':'predict';}
 #assertIdentity(identity){if(!identity||identity.lessonId!==this.#envelope.id||identity.version!==this.version)throw Error('Stale lesson identity or version.');}
 accept(envelope,{preservePinned=true}={}){
  if(!envelope||typeof envelope.id!=='string'||!envelope.id.trim()||envelope.id.length>100)throw Error('Lesson identity is invalid.');
  validateControls(envelope.lesson);const version=envelope.version??1;
  if(!Number.isInteger(version)||version<1)throw Error('Lesson version is invalid.');
  const accepted=snapshot({...envelope,version});this.#envelope=accepted;this.#params=snapshot(Object.fromEntries(accepted.lesson.controls.map(c=>[c.id,c.initial])));
  this.#prediction=null;this.#results=null;this.#viewport=null;if(!preservePinned)this.#pinned=null;return this.read();
 }
 predict({selectedIndex,reason,confidence},identity=this.identity){
  this.#assertIdentity(identity);if(this.#prediction)throw Error('The original prediction is already saved.');
  if(!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>=this.lesson.prediction.options.length)throw Error('Choose a valid prediction.');
  if(typeof reason!=='string'||reason.length>2000)throw Error('Prediction reason must be text up to 2000 characters.');
  if(!Number.isFinite(confidence)||confidence<0||confidence>100)throw Error('Confidence must be between 0 and 100.');
  this.#prediction=snapshot({...this.identity,selectedIndex,reason:reason.trim(),confidence,params:this.#params});return this.#prediction;
 }
 setControl(id,value,identity=this.identity){return this.setParams({[id]:value},identity);}
 setParams(patch,identity=this.identity){
  this.#assertIdentity(identity);if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Control values must be an object.');
  const next={...this.#params};for(const [id,value]of Object.entries(patch)){const control=this.lesson.controls.find(c=>c.id===id);if(!control)throw Error(`Unknown control: ${id}.`);next[id]=validateControlValue(control,value);}
  if(Object.keys(next).some(k=>next[k]!==this.#params[k])){this.#params=snapshot(next);this.#results=null;this.#viewport=null;}return this.#params;
 }
 recordRun(results,options={}){
  const {params=this.#params,viewport={width:720,height:340,progress:1}}=options;
  this.#assertIdentity({lessonId:options.lessonId??this.identity.lessonId,version:options.version??this.version});
  if(!this.#prediction)throw Error('Save a prediction before running.');
  if(!params||Object.keys(params).length!==Object.keys(this.#params).length||Object.keys(this.#params).some(k=>params[k]!==this.#params[k]))throw Error('Run conditions are stale.');
  validateExperimentResult(results);if(!viewport||![viewport.width,viewport.height,viewport.progress].every(Number.isFinite)||viewport.width<=0||viewport.height<=0||viewport.progress<0||viewport.progress>1)throw Error('Invalid run viewport.');
  this.#results=snapshot(results);this.#viewport=snapshot(viewport);return this.#results;
 }
 pinRun(identity=this.identity){this.#assertIdentity(identity);if(!this.#results)throw Error('Run the experiment before pinning.');this.#pinned=snapshot({...this.identity,title:this.lesson.title,lesson:this.lesson,params:this.#params,viewport:this.#viewport,results:this.#results});return this.#pinned;}
 clearPinned(){this.#pinned=null;}
 read(){return snapshot({...this.identity,title:this.lesson.title,claim:this.lesson.claim,phase:this.phase,controls:this.lesson.controls,params:this.#params,prediction:this.#prediction,results:this.#results?{metrics:this.#results.metrics,summary:this.#results.summary}:null,pinned:this.#pinned?{lessonId:this.#pinned.lessonId,version:this.#pinned.version,title:this.#pinned.title,params:this.#pinned.params,results:{metrics:this.#pinned.results.metrics,summary:this.#pinned.results.summary}}:null});}
}
