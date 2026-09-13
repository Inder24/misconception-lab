import {newtonCradle} from './newton-cradle.js';
import {setupDebugPanel,traceRequest} from './debug-panel.js';
import {starter} from './starter.js';
import {validateLesson} from './lesson-schema.js';
import {LabState} from './lab-state.js';
import {SandboxExperiment} from './experiment-host.js';
import {preflightLesson} from './experiment-checks.js';
import {buildCheckedLesson} from './lab-pipeline.js';
import {createLivePartner} from './live-client.js';
import {setupImageInput} from './image-input.js';
import {setupPlanner,showWorkspace} from './planner.js';
import {createPlayback} from './playback.js';
import {$,text,renderChoices,renderMetrics,renderReceipt,addMessage,showError,conditionLabels,renderComparison} from './lab-ui.js';

const debug=setupDebugPanel();
const request=traceRequest(apiRequest,debug.journal,debug.setCode);
const state=new LabState(starter);
let selected=null,host=null,baselineHost=null,needsReload=false,hasRun=false,loading=false;
let buildController=null,tutorController=null,buildEpoch=0,lessonEpoch=0,runEpoch=0,tutorEpoch=0;
let imageBusy=false,tutorBusy=false,apiReady=false,voiceActive=false,plannerBusy=false;
let planner=null,playback=null,playbackContext=null,controlEpoch=0,conditionPending=false;
let shelf=[],tutorHistory=[],followupQuestion=starter.lesson.followup,controlTimer;
const sameIdentity=(a,b)=>a.lessonId===b.lessonId&&a.version===b.version;
const currentIdentity=()=>({...state.identity});
try{const entries=JSON.parse(localStorage.getItem('ml-lessons-v3')||localStorage.getItem('ml-lessons-v2')||'[]');if(Array.isArray(entries))shelf=entries.filter(x=>{if(x?.source!=='astra'||typeof x.id!=='string'||!validateLesson(x.lesson))return false;try{new LabState(x);return true;}catch{return false;}}).slice(0,8);}catch{}

async function apiRequest(path,body,{signal}={}){
  const timeout=AbortSignal.timeout(120000);
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,timeout]):timeout});
  let data;try{data=await response.json();}catch{throw Error('The server returned an unreadable response. Please try again.');}
  if(!response.ok)throw Error(data.error||'The request could not be completed.');
  return data;
}
function setActions(){
  text('coach-stage',hasRun?'03 / RETHINK':'01 / MAKE A PREDICTION');text('coach-title',hasRun?'What did you notice?':'What’s your hunch?');text('coach-hint',hasRun?'Your first prediction is kept below. Compare it with what happened.':'No pressure to be right. This is where discovery starts.');
  const busy=Boolean(buildController)||imageBusy||loading||plannerBusy||conditionPending;
  $('generate').disabled=busy||tutorBusy;$('revise').disabled=busy||tutorBusy;$('claim').disabled=Boolean(buildController);
  $('run').disabled=busy||(!state.prediction&&selected===null);
  $('run-mobile').disabled=$('run').disabled;text('run-mobile',hasRun?'Replay experiment →':'Test my prediction →');$('try-starter').disabled=busy||tutorBusy;$('try-cradle').disabled=busy||tutorBusy;
  $('controls').disabled=busy||!hasRun;
  $('pin-run').disabled=busy||!state.results;
  $('ask-tutor').disabled=busy||tutorBusy||!state.results;
  $('next-question').disabled=busy||tutorBusy||!state.results;
  $('photo-input').disabled=busy||tutorBusy;$('open-sketch').disabled=busy||tutorBusy;
  for(const button of document.querySelectorAll('[data-example]'))button.disabled=busy;
  for(const button of document.querySelectorAll('.history-item'))button.disabled=busy;
  for(const control of $('playback-controls').querySelectorAll('button,input,select'))control.disabled=busy||!state.results;
  planner?.setBusy(Boolean(buildController)||imageBusy||loading||tutorBusy||conditionPending);
  for(const phase of ['predict','test','explain'])$('step-'+phase).classList.toggle('active',state.phase===phase);
}
function syncVoice(){live.sync();}
function invalidateTutor(){
  tutorEpoch++;tutorController?.abort();tutorController=null;tutorBusy=false;setActions();
}
function clearChangedResult(){
  $('metrics').replaceChildren();$('experiment-container').hidden=true;
  text('summary','Conditions changed. Checking the new result…');
}
function setPredictionControls(){
  const prediction=state.prediction;
  if(prediction){selected=prediction.selectedIndex;$('prediction-reason').value=prediction.reason;$('confidence').value=prediction.confidence;text('confidence-value',prediction.confidence+'%');}
  renderChoices('prediction-options',state.lesson.prediction,index=>{selected=index;text('run-status','Prediction selected · ready to test');setActions();},{selected,disabled:Boolean(prediction)});
  $('prediction-reason').disabled=Boolean(prediction);$('confidence').disabled=Boolean(prediction);
}
function renderControls(){
  $('controls').replaceChildren();
  for(const control of state.lesson.controls){
    const label=document.createElement('label'),line=document.createElement('span'),title=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');
    title.textContent=control.label;input.type='range';input.id='control-'+control.id;input.min=control.min;input.max=control.max;input.step=control.step;input.value=state.params[control.id];input.setAttribute('aria-label',control.label);output.htmlFor=input.id;output.textContent=state.params[control.id]+' '+control.unit;
    line.append(title,output);label.append(line,input);$('controls').append(label);
    input.addEventListener('input',()=>{
      output.textContent=input.value+' '+control.unit;
      const patch=Object.fromEntries(state.lesson.controls.map(c=>[c.id,Number($('control-'+c.id).value)])),identity=currentIdentity(),token=++controlEpoch;
      runEpoch++;conditionPending=true;invalidateTutor();clearTimeout(controlTimer);setActions();
      playback.reset().then(()=>{
        if(token!==controlEpoch||!sameIdentity(identity,state.identity))return;
        state.setParams(patch);clearChangedResult();text('run-status','Conditions changed');renderComparison(state);setActions();syncVoice();
        controlTimer=setTimeout(()=>runCurrent({animate:state.envelope.id==='curated-newton-cradle',automaticTutor:false}).catch(handleRunError),100);
      }).catch(error=>showError(error.message)).finally(()=>{if(token===controlEpoch){conditionPending=false;setActions();}});
    });
  }
}
function renderShelf(){
  $('history-list').replaceChildren();
  for(const entry of [starter,...shelf]){
    const button=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('span');button.type='button';button.className='history-item';button.setAttribute('aria-current',String(entry.id===state.identity.lessonId));title.textContent=entry.lesson.title;meta.textContent=entry.source==='astra'?`${entry.lesson.domain} · ${entry.validation?.runtime?.passed?'Checked':'Saved lesson'}`:'Physics · Built-in reference';button.append(title,meta);
    button.addEventListener('click',()=>{cancelBuild();imageInput.cancel();loadLesson(entry).catch(error=>showError(error.message));});$('history-list').append(button);
  }
}
function saveLesson(entry){shelf=[entry,...shelf.filter(x=>x.id!==entry.id)].slice(0,8);try{localStorage.setItem('ml-lessons-v3',JSON.stringify(shelf));}catch{showError('This browser could not save the lesson. It is still available on the workbench.');}renderShelf();}
function resetFollowup(){followupQuestion=state.lesson.followup;text('followup-source','Built-in question');text('reasoning-focus','A new situation to test the idea.');text('followup-prompt',followupQuestion.prompt);text('followup-feedback','');$('next-question').hidden=true;renderFollowupOptions();}
function renderFollowupOptions(){
  renderChoices('followup-options',followupQuestion,index=>{text('followup-feedback',followupQuestion.feedback[index]);tutorHistory.push({role:'user',text:`For the question "${followupQuestion.prompt}", I chose "${followupQuestion.options[index]}".`});tutorHistory=tutorHistory.slice(-10);$('next-question').hidden=false;});
}
async function loadLesson(entry,{preservePinned=false,signal}={}){
  const token=++lessonEpoch;runEpoch++;controlEpoch++;conditionPending=false;invalidateTutor();clearTimeout(controlTimer);loading=true;setActions();
  await playback?.pause();
  const candidate=new SandboxExperiment($('experiment-container'));
  try{
    await candidate.load(entry.lesson.code,{signal});signal?.throwIfAborted();
    if(token!==lessonEpoch){candidate.destroy();return;}
    state.accept(entry,{preservePinned});await playback?.reset();playbackContext=null;host?.destroy();host=candidate;needsReload=false;selected=null;hasRun=false;tutorHistory=[];
    $('experiment-container').hidden=true;$('prediction-cover').hidden=false;$('frame-error').hidden=true;$('explanation').hidden=true;$('followup').hidden=true;$('playback-controls').hidden=true;$('metrics').replaceChildren();$('tutor-messages').replaceChildren();
    $('drop-preview').hidden=entry.source!=='built-in';$('idea-preview').hidden=entry.source==='built-in';
    text('domain',entry.lesson.domain.toUpperCase());text('lesson-title',entry.lesson.title);text('lesson-claim','“'+entry.lesson.claim+'”');text('prediction-prompt',entry.lesson.prediction.prompt);text('source',entry.source==='astra'?`Astra · v${state.version}`:entry.source==='curated'?'Reference model':'Built-in reference');text('visual-title','Your experiment');text('run-status','Make a prediction first');text('summary','What do you expect to happen?');text('run','▶ Run experiment');text('tutor-status',apiReady?'Make a prediction and run the lab to explore together.':'Reference lesson available · AI features need API setup.');text('source-code',entry.lesson.code);text('lesson-meta',entry.source==='astra'?`Generated with GPT-6 Astra · ${new Date(entry.createdAt).toLocaleDateString()}${entry.brief?' · '+entry.brief.grade+' · '+entry.brief.subject:''}`:entry.source==='curated'?`${entry.catalog.topic} · ${entry.catalog.grade} · Original reference model`:'Built-in reference · idealized falling-objects model');
    $('prediction-reason').value='';$('confidence').value=50;text('confidence-value','50%');
    $('assumptions').replaceChildren();for(const assumption of entry.lesson.assumptions){const li=document.createElement('li');li.textContent=assumption;$('assumptions').append(li);}
    renderControls();setPredictionControls();resetFollowup();
    const checks=entry.validation?.runtime?.runs?.length;
    text('check-summary',checks?`${checks} runs checked · ${entry.validation.repairs} repairs`:entry.source==='built-in'?'Built-in reference':'Saved lesson · checks not recorded');
    renderReceipt(entry.validation?.receipt||[{stage:'reference',status:'passed',detail:entry.source==='built-in'?'Built-in falling-objects reference. Automated browser tests check its vacuum and drag calculations.':'This saved lesson predates recorded checks. Build a new version to check it.'}]);
    renderShelf();
    if(state.pinned){$('comparison').hidden=false;renderComparison(state);}else{baselineHost?.destroy();baselineHost=null;$('baseline-container').replaceChildren();$('comparison').hidden=true;}
    const url=new URL(location.href);entry.source==='astra'?url.searchParams.set('lesson',entry.id):url.searchParams.delete('lesson');history.replaceState({},'',url);syncVoice();
  }catch(error){candidate.destroy();throw error;}
  finally{if(token===lessonEpoch){loading=false;setActions();}}
}
function recordPrediction({selectedIndex=selected,reason=$('prediction-reason').value,confidence=Number($('confidence').value)}={},identity=state.identity){
  state.predict({selectedIndex,reason:reason.trim()||'No written reason provided.',confidence},identity);setPredictionControls();setActions();syncVoice();
}
function handleRunError(error){if(error.name==='AbortError')return;debug.journal.add({stage:'sandbox',status:'failed',detail:error.message});needsReload=true;text('frame-error',error.message||'This experiment could not run. Replay to retry.');$('frame-error').hidden=false;text('run-status','Replay to retry the experiment');setActions();}
async function runCurrent({animate=true,automaticTutor=true,signal}={}){
  signal?.throwIfAborted();if(loading||buildController||conditionPending||plannerBusy)throw Error('Wait for the current lab action to finish.');
  if(!state.prediction)recordPrediction();
  const identity=currentIdentity(),params={...state.params},epoch=++runEpoch,first=!hasRun;
  const valid=()=>epoch===runEpoch&&sameIdentity(identity,state.identity)&&!signal?.aborted;
  await playback.reset();if(!valid())return null;
  if(needsReload){await host.load(state.lesson.code,{signal});needsReload=false;}
  $('frame-error').hidden=true;text('run-status','Running the experiment…');
  const viewport={width:Math.max(260,Math.round($('experiment-container').parentElement.clientWidth)),height:340,progress:1};
  try{
    const result=await host.run(params,viewport,{signal});
    if(!valid())return null;
    state.recordRun(result,{...identity,params,viewport});hasRun=true;debug.journal.add({stage:'sandbox',status:'passed',detail:`Experiment executed · ${result.metrics.length} measurements returned`});
    $('prediction-cover').hidden=true;$('experiment-container').hidden=false;renderMetrics($('metrics'),result.metrics);text('summary',result.summary);text('run-status','Change a control to test another condition');text('run','↻ Replay experiment');
    $('explanation').hidden=false;$('followup').hidden=false;
    text('verdict',({misconception:'A BELIEF WORTH REVISING',partly_true:'IT DEPENDS ON THE CONDITIONS',accurate:'YOUR CLAIM HOLDS UP',not_testable:'AN EXPLANATION, NOT A PROOF'})[state.lesson.verdict]);
    text('feedback',state.lesson.prediction.feedback[state.prediction.selectedIndex]);text('explanation-text',state.lesson.explanation);text('conditions-note','Your original prediction was for: '+conditionLabels(state.lesson,state.prediction.params));
    playbackContext={identity,params,viewport,epoch};$('playback-controls').hidden=false;
    renderComparison(state);setActions();syncVoice();
    if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await playback.play();else await playback.seek(1);
    if(!valid())return null;
    if(first&&automaticTutor&&apiReady&&!imageBusy&&!buildController)askTutor(undefined,{automatic:true}).catch(()=>{});
    return {...state.read(),ok:true};
  }catch(error){if(sameIdentity(identity,state.identity)){needsReload=true;if(error.name!=='AbortError')handleRunError(error);}throw error;}
}
$('run').addEventListener('click',()=>runCurrent().catch(handleRunError));
$('run-mobile').addEventListener('click',()=>{document.querySelector('.workbench').scrollIntoView({behavior:'smooth',block:'start'});runCurrent().catch(handleRunError);});
$('confidence').addEventListener('input',()=>text('confidence-value',$('confidence').value+'%'));
async function pinRun(){
  state.pinRun();$('comparison').hidden=false;baselineHost?.destroy();$('baseline-container').replaceChildren();baselineHost=new SandboxExperiment($('baseline-container'),{title:'Pinned baseline experiment'});
  await baselineHost.load(state.pinned.lesson.code);
  await baselineHost.run(state.pinned.params,{width:320,height:340,progress:1});
  renderComparison(state);syncVoice();return {...state.read(),ok:true};
}
$('pin-run').addEventListener('click',()=>pinRun().catch(error=>showError(error.message)));
$('clear-comparison').addEventListener('click',()=>{state.clearPinned();baselineHost?.destroy();baselineHost=null;$('comparison').hidden=true;syncVoice();});

async function checkCandidate(lesson,{signal}={}){
  const container=document.createElement('div');container.style.width='720px';$('preflight-container').append(container);const candidate=new SandboxExperiment(container,{title:'Checking generated experiment'});
  try{await candidate.load(lesson.code,{signal});return await preflightLesson(lesson,(params,viewport,options)=>candidate.run(params,viewport,options),{signal,onProgress:({completed,total,check})=>{text('generation-detail',`Checking case ${completed} of ${total} · controls, sizes, and animation`);debug.journal.add({stage:'sandbox',status:check.passed?'passed':'failed',detail:`Case ${completed}/${total} · ${check.detail}`});}});}
  finally{candidate.destroy();container.remove();}
}
function cancelBuild(){if(buildController)debug.journal.add({stage:'build',status:'cancelled',detail:'Cancellation requested'});buildEpoch++;buildController?.abort();buildController=null;$('generation').hidden=true;setActions();}
$('cancel').addEventListener('click',()=>{cancelBuild();planner?.cancel();text('run-status',state.prediction?'Your current experiment is still available':'Make a prediction first');});
async function buildLesson(endpoint,payload,{signal,preservePinned=false}={}){
  if(buildController||imageBusy||tutorBusy)throw Error('Let the current request finish before building another experiment.');
  const controller=new AbortController();buildController=controller;const epoch=++buildEpoch;const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  runEpoch++;controlEpoch++;clearTimeout(controlTimer);invalidateTutor();$('generation').hidden=false;$('error').hidden=true;setActions();
  try{
    await playback.reset();
    const entry=await buildCheckedLesson({endpoint,payload,request,check:checkCandidate,signal:combined,onProgress:(event,receipt)=>{
      if(epoch!==buildEpoch)return;
      debug.journal.add({stage:event.stage,status:event.status,detail:event.detail});
      const titles={build:'Designing your experiment',test:'Testing the generated experiment',review:'Checking the explanation and results',repair:'Repairing the experiment',check:'A check found something to fix',ready:'Your experiment is ready'};
      text('generation-title',titles[event.stage]||'Checking experiment');text('generation-detail',event.detail);renderReceipt(receipt||[]);
    }});
    combined.throwIfAborted();if(epoch!==buildEpoch)return null;
    if(preservePinned){entry.version=state.version+1;entry.parentId=state.identity.lessonId;}
    await loadLesson(entry,{preservePinned,signal:combined});
    if(epoch!==buildEpoch)return null;
    saveLesson(entry);$('lesson-title').setAttribute('tabindex','-1');$('lesson-title').focus({preventScroll:true});$('lesson-title').scrollIntoView({behavior:'smooth',block:'start'});
    return {ok:true,...state.read()};
  }catch(error){if(epoch===buildEpoch&&error.name!=='AbortError'){showError(error.message);if(error.receipt)renderReceipt(error.receipt);}throw error;}
  finally{if(epoch===buildEpoch){buildController=null;$('generation').hidden=true;setActions();}}
}
$('claim-form').addEventListener('submit',event=>{event.preventDefault();buildLesson('/api/lessons',{claim:$('claim').value.trim()}).catch(()=>{});});
for(const button of document.querySelectorAll('[data-example]'))button.addEventListener('click',()=>{$('claim').value=button.dataset.example;$('claim').focus();});
async function reviseExperiment(message,{signal}={}){
  if(state.results&&!state.pinned)await pinRun();signal?.throwIfAborted();
  return buildLesson('/api/revise',{lesson:state.lesson,request:message,params:state.params,...(state.envelope.brief?{brief:state.envelope.brief}:{})},{signal,preservePinned:true});
}
$('whatif-form').addEventListener('submit',event=>{event.preventDefault();reviseExperiment($('whatif').value.trim()).catch(error=>{if(error.name!=='AbortError')showError(error.message);});});

async function askTutor(message,{automatic=false,signal}={}){
  if(!state.results)throw Error('Make a prediction and run the experiment before asking about the results.');
  if(buildController||imageBusy||tutorBusy)throw Error('Let the current request finish first.');
  const identity=currentIdentity(),params=JSON.stringify(state.params),epoch=++tutorEpoch;
  tutorController=new AbortController();const combined=signal?AbortSignal.any([signal,tutorController.signal]):tutorController.signal;tutorBusy=true;setActions();
  text('tutor-status','Thinking about your reasoning and the experiment…');
  if(message&&!automatic){addMessage($('tutor-messages'),'user',message);tutorHistory.push({role:'user',text:message});}
  try{
    const history=tutorHistory.slice(-9).map(entry=>({...entry,text:entry.text.slice(0,2400)}));
    history.push({role:'assistant',text:`The currently displayed transfer question is: ${followupQuestion.prompt} Options: ${followupQuestion.options.map((option,index)=>`${index+1}. ${option}`).join(' | ')}`.slice(0,2400)});
    const data=await request('/api/tutor',{lesson:state.lesson,selectedIndex:state.prediction.selectedIndex,reason:state.prediction.reason,confidence:state.prediction.confidence,params:state.params,results:{metrics:state.results.metrics,summary:state.results.summary},history,...(state.envelope.brief?{brief:state.envelope.brief}:{}),...(message?{message}:{})},{signal:combined});
    combined.throwIfAborted();if(epoch!==tutorEpoch||!sameIdentity(identity,state.identity)||params!==JSON.stringify(state.params))return null;
    addMessage($('tutor-messages'),'assistant',data.message);tutorHistory.push({role:'assistant',text:data.message});tutorHistory=tutorHistory.slice(-10);
    followupQuestion=data.question;text('followup-source','Adapted to your reasoning');text('reasoning-focus',data.reasoningFocus);text('followup-prompt',data.question.prompt);text('followup-feedback','');$('next-question').hidden=true;renderFollowupOptions();text('tutor-status','A new question, based on how you approached this experiment.');
    return {ok:true,...identity,message:data.message,question:{prompt:data.question.prompt,options:data.question.options}};
  }catch(error){if(epoch===tutorEpoch&&error.name!=='AbortError'){text('tutor-status',error.message);if(!automatic)addMessage($('tutor-messages'),'assistant','I could not complete that request. Your experiment and current question are still available.');}throw error;}
  finally{if(epoch===tutorEpoch){tutorBusy=false;tutorController=null;setActions();}}
}
$('tutor-form').addEventListener('submit',event=>{event.preventDefault();const message=$('tutor-message').value.trim();if(!message)return;$('tutor-message').value='';askTutor(message).catch(error=>text('tutor-status',error.message));});
$('next-question').addEventListener('click',()=>askTutor('Give me a different transfer question based on my last answer.').catch(error=>text('tutor-status',error.message)));

async function executeTool(name,args,{signal}={}){
  signal?.throwIfAborted();
  if(name==='read_lab')return getLiveState();
  if(conditionPending||plannerBusy||loading||imageBusy||buildController)throw Error('Wait for the current lab action to finish.');
  if(!sameIdentity(args,state.identity))throw Error('This action belongs to an older experiment. Read the current lab first.');
  if(name==='record_prediction'){recordPrediction(args,args);return {ok:true,...getLiveState()};}
  if(name==='set_control'){
    if(!state.prediction)throw Error('Ask the learner to make a prediction first.');
    runEpoch++;const token=++controlEpoch;conditionPending=true;clearTimeout(controlTimer);setActions();
    try{await playback.reset();signal?.throwIfAborted();state.setControl(args.controlId,args.value,args);invalidateTutor();clearChangedResult();renderControls();renderComparison(state);syncVoice();}
    finally{if(token===controlEpoch){conditionPending=false;setActions();}}
    if(hasRun)return await runCurrent({animate:false,automaticTutor:false,signal});
    return {ok:true,...getLiveState()};
  }
  if(name==='run_experiment'){if(!state.prediction)throw Error('Record the learner’s prediction before running.');return runCurrent({animate:false,automaticTutor:false,signal});}
  if(name==='revise_experiment')return reviseExperiment(args.request,{signal});
  if(name==='ask_followup')return askTutor(args.message,{signal});
  if(name==='compare_runs'){if(!state.pinned){await pinRun();return {ok:true,...getLiveState(),message:'The current run is now pinned as the baseline. Change a control and run again to compare different conditions.'};}renderComparison(state);return {ok:true,...getLiveState()};}
  throw Error('That lab action is not supported.');
}
function getLiveState(){return {...state.read(),predictionQuestion:{prompt:state.lesson.prediction.prompt,options:state.lesson.prediction.options},...(hasRun?{followupQuestion:{prompt:followupQuestion.prompt,options:followupQuestion.options}}:{})};}
const transcripts=new Set();let caption=null;
const live=createLivePartner({getState:getLiveState,onTool:executeTool,onStatus:status=>{
  voiceActive=Boolean(status.microphone)||['requesting-microphone','connecting','connected','working','playback-blocked'].includes(status.state);
  $('voice-toggle').setAttribute('aria-pressed',String(voiceActive));text('voice-toggle',voiceActive?'Stop live':'Start live');$('voice-toggle').setAttribute('aria-label',voiceActive?'Stop live conversation':'Start live conversation');text('voice-status',status.message||status.state);
  if(['error','permission-denied','disconnected'].includes(status.state)){text('voice-error',status.message||'The live conversation stopped.');$('voice-error').hidden=false;}
  if(status.state==='connected'){$('voice-error').hidden=true;$('transcript-panel').hidden=false;$('transcript-panel').open=true;}
  if(status.state==='playback-blocked'&&status.audioElement){status.audioElement.controls=true;$('transcript-panel').append(status.audioElement);}
},onTranscript:entry=>{
  if(entry.id&&transcripts.has(entry.id))return;if(entry.id)transcripts.add(entry.id);
  $('transcript-panel').hidden=false;
  const gap=Number.isFinite(entry.startMs)&&Number.isFinite(caption?.endMs)?entry.startMs-caption.endMs:0;
  if(!caption||caption.role!==entry.role||gap>1500){caption={role:entry.role,text:entry.text,endMs:entry.endMs,item:addMessage($('transcript'),entry.role,entry.text)};}
  else{caption.text+=entry.text;caption.endMs=entry.endMs;const label=document.createElement('small');label.textContent=entry.role==='user'?'You':'Lab partner';caption.item.replaceChildren(label,document.createTextNode(caption.text));}
}});
$('voice-toggle').addEventListener('click',async()=>{try{if(voiceActive)await live.stop();else if(!apiReady){text('voice-error','Configure the server’s OpenAI API key to start a live conversation.');$('voice-error').hidden=false;}else await live.start();}catch(error){text('voice-error',error.message);$('voice-error').hidden=false;}});
playback=createPlayback({
  render:async progress=>{
    const context=playbackContext;
    if(!context||!state.results||loading||!sameIdentity(context.identity,state.identity)||JSON.stringify(context.params)!==JSON.stringify(state.params))return;
    await host.run(context.params,{...context.viewport,progress});
  },
  onChange:({progress,playing,speed})=>{
    text('playback-toggle',playing?'Ⅱ Pause':'▶ Play');$('playback-toggle').setAttribute('aria-label',playing?'Pause animation':'Play animation');
    $('playback-progress').value=Math.round(progress*100);text('playback-position',Math.round(progress*100)+'%');$('playback-speed').value=String(speed);
  },onError:handleRunError
});
$('playback-toggle').addEventListener('click',()=>{debug.journal.add({stage:'playback',detail:playback.getState().playing?'Pause requested':'Play requested'});if(playback.getState().playing)playback.pause();else if(needsReload)runCurrent().catch(handleRunError);else playback.play();});
$('playback-progress').addEventListener('input',()=>playback.seek(Number($('playback-progress').value)/100));
$('playback-speed').addEventListener('change',()=>playback.setSpeed(Number($('playback-speed').value)));
$('reset-conditions').addEventListener('click',async()=>{
  const identity=currentIdentity(),token=++controlEpoch;runEpoch++;conditionPending=true;clearTimeout(controlTimer);setActions();
  try{
    await playback.reset();if(token!==controlEpoch||!sameIdentity(identity,state.identity))return;
    state.setParams(Object.fromEntries(state.lesson.controls.map(c=>[c.id,c.initial])));invalidateTutor();renderControls();clearChangedResult();conditionPending=false;setActions();
    await runCurrent({animate:false,automaticTutor:false});text('run-status','Initial conditions restored · your original prediction is kept');
  }catch(error){handleRunError(error);}finally{if(token===controlEpoch){conditionPending=false;setActions();}}
});
async function openStarter(entry,{signal}={}){
  if(buildController||imageBusy||tutorBusy||loading)throw Error('Let the current request finish first.');
  const controller=new AbortController();buildController=controller;const epoch=++buildEpoch;
  const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  runEpoch++;controlEpoch++;clearTimeout(controlTimer);$('generation').hidden=false;$('error').hidden=true;text('generation-title','Checking the reference experiment');setActions();
  try{
    await playback.reset();const runtime=await checkCandidate(entry.lesson,{signal:combined});combined.throwIfAborted();
    if(!runtime.passed)throw Error('The reference model did not pass its browser checks. Your current experiment is kept.');
    const receipt=[{stage:'reference',status:'passed',detail:'Original reference model. Its calculations are covered by independently written numerical tests.'},{stage:'test',status:'passed',detail:`${runtime.runs.length} browser execution cases passed across controls, sizes and playback positions.`}];
    await loadLesson({...entry,validation:{runtime,repairs:0,receipt}},{signal:combined});
    if(epoch!==buildEpoch)return null;
    return {ok:true,...state.read()};
  }finally{if(epoch===buildEpoch){buildController=null;$('generation').hidden=true;setActions();}}
}
const imageInput=setupImageInput({request,onClaim:claim=>{$('claim').value=claim;},onError:showError,onBusy:busy=>{imageBusy=busy;setActions();}});
planner=setupPlanner({request,onBuild:(payload,options)=>buildLesson('/api/lessons',payload,options),onOpenStarter:openStarter,onBusy:busy=>{plannerBusy=busy;setActions();},isLabBusy:()=>Boolean(buildController)||loading||imageBusy||tutorBusy||conditionPending});
let resizeTimer;
function refreshVisibleExperiment(){if(hasRun&&!$('panel-experiment').hidden&&!loading&&!buildController&&!plannerBusy&&!conditionPending)runCurrent({animate:false,automaticTutor:false}).catch(handleRunError);}
addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refreshVisibleExperiment,200);});
addEventListener('workspacechange',event=>{if(event.detail==='experiment'){clearTimeout(resizeTimer);resizeTimer=setTimeout(refreshVisibleExperiment,0);}else playback.pause();});
addEventListener('pagehide',()=>{cancelBuild();planner?.cancel();invalidateTutor();playback.destroy().then(()=>host?.destroy());baselineHost?.destroy();live.stop();});
const initial=shelf.find(x=>x.id===new URL(location.href).searchParams.get('lesson'))||starter;
loadLesson(initial).catch(async error=>{showError(error.message);if(initial!==starter)await loadLesson(starter).catch(fallback=>showError(fallback.message));});
fetch('/api/status').then(r=>r.json()).then(data=>{apiReady=Boolean(data.ready);text('connection',apiReady?'API key configured':'API setup needed');$('connection').dataset.ready=String(apiReady);text('tutor-status',apiReady?'Make a prediction and run the lab to explore together.':'Built-in lesson available · AI features need API setup.');}).catch(()=>text('connection','Server unavailable'));

$('try-starter').addEventListener('click',()=>loadLesson(starter).then(()=>{$('lesson-title').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}).catch(error=>showError(error.message)));

for(const link of document.querySelectorAll('.site-header nav a'))link.addEventListener('click',()=>showWorkspace('experiment'));

$('try-cradle').addEventListener('click',async()=>{try{const result=await openStarter(newtonCradle,{});if(result?.ok){showWorkspace('experiment');$('lesson-title').scrollIntoView({behavior:'smooth',block:'start'});}}catch(error){showError(error.message);}});
