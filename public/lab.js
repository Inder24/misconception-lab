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
import {setupPlanner} from './planner.js';
import {createPlayback} from './playback.js';
import {setupDropLab} from './drop-lab.js';
import {setupWalkthrough} from './walkthrough.js';
import {mathStarter} from './math-starter.js';
import {setupMathLab} from './math-lab.js';
import {setupFlow,showScreen,currentScreen} from './flow.js';
import {$,text,renderChoices,renderMetrics,renderReceipt,addMessage,showError,conditionLabels,renderComparison} from './lab-ui.js';

const debug=setupDebugPanel();
const request=traceRequest(apiRequest,debug.journal,debug.setCode);
const state=new LabState(starter);
let selected=null,host=null,baselineHost=null,needsReload=false,hasRun=false,loading=false;
let buildController=null,tutorController=null,buildEpoch=0,lessonEpoch=0,runEpoch=0,tutorEpoch=0,buildReturnScreen=null;
let imageBusy=false,tutorBusy=false,apiReady=false,voiceActive=false,plannerBusy=false;
let planner=null,playback=null,dropLab=null,mathLab=null,guide=null,walkthroughBusy=false,playbackContext=null,controlEpoch=0,conditionPending=false;
let shelf=[],tutorHistory=[],followupQuestion=starter.lesson.followup,controlTimer;
const sameIdentity=(a,b)=>a.lessonId===b.lessonId&&a.version===b.version;
const currentIdentity=()=>({...state.identity});
const isDropLab=()=>state.envelope.source==='built-in'&&state.identity.lessonId===starter.id&&state.lesson.code===starter.lesson.code;
const isMathLab=()=>state.envelope.source===mathStarter.source&&state.identity.lessonId===mathStarter.id&&state.lesson.code===mathStarter.lesson.code;
const isCradleLab=()=>state.envelope.source===newtonCradle.source&&state.identity.lessonId===newtonCradle.id&&state.lesson.code===newtonCradle.lesson.code;
try{const entries=JSON.parse(localStorage.getItem('ml-lessons-v3')||localStorage.getItem('ml-lessons-v2')||'[]');if(Array.isArray(entries))shelf=entries.filter(x=>{if(x?.source!=='astra'||typeof x.id!=='string'||!validateLesson(x.lesson))return false;try{new LabState(x);return true;}catch{return false;}}).slice(0,8);}catch{}

async function apiRequest(path,body,{signal}={}){
  const timeout=AbortSignal.timeout(120000);
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,timeout]):timeout});
  let data;try{data=await response.json();}catch{throw Error('The server returned an unreadable response. Please try again.');}
  if(!response.ok)throw Error(data.error||'The request could not be completed.');
  return data;
}
function setActions(){
  const building=Boolean(buildController);
  $('screen-lab').classList.toggle('is-building',building);document.body.classList.toggle('experiment-building',building);
  for(const id of ['pending-lesson-heading','pending-toolbar','pending-partner'])$(id).hidden=!building;
  document.querySelector('.coach').classList.toggle('has-prediction',hasRun);$('prediction-record').hidden=!hasRun;
  if(state.prediction){text('prediction-record-choice',state.lesson.prediction.options[state.prediction.selectedIndex]);text('prediction-record-note',state.prediction.confidence+'% confident · your first hunch is kept');}
  $('run-mobile').hidden=hasRun;
  text('coach-stage',hasRun?'03 / RETHINK':'01 / MAKE A PREDICTION');text('coach-title',hasRun?'What did you notice?':'What’s your hunch?');text('coach-hint',hasRun?'Your first prediction is kept below. Compare it with what happened.':'No pressure to be right. This is where discovery starts.');
  const busy=Boolean(buildController)||imageBusy||loading||plannerBusy||conditionPending||walkthroughBusy;
  $('voice-toggle').disabled=busy&&!voiceActive;
  $('experiment-loading').hidden=!buildController;$('experiment-container').setAttribute('aria-busy',String(Boolean(buildController)));
  $('generate').disabled=busy||tutorBusy;$('revise').disabled=busy||tutorBusy;$('claim').disabled=Boolean(buildController);
  $('run').disabled=busy||(!state.prediction&&selected===null);
  $('run-mobile').disabled=$('run').disabled;text('run-mobile',hasRun?'Replay experiment →':'Test my prediction →');$('try-starter').disabled=busy||tutorBusy;$('try-cradle').disabled=busy||tutorBusy;
  $('controls').disabled=busy||!hasRun;
  $('pin-run').disabled=busy||!state.results;
  $('ask-tutor').disabled=busy||tutorBusy||!state.results;
  $('next-question').disabled=busy||tutorBusy||!state.results;
  $('photo-input').disabled=busy||tutorBusy;$('open-sketch').disabled=busy||tutorBusy;
  for(const button of document.querySelectorAll('[data-example]'))button.disabled=busy;
  $('try-math').disabled=busy||tutorBusy;
  for(const button of document.querySelectorAll('.history-item'))button.disabled=busy;
  for(const control of $('playback-controls').querySelectorAll('button,input,select'))control.disabled=busy||!state.results;
  planner?.setBusy(Boolean(buildController)||imageBusy||loading||tutorBusy||conditionPending||walkthroughBusy);
  dropLab?.update({active:isDropLab(),params:state.params,revealed:hasRun,busy,ready:Boolean(state.results)&&!needsReload});
  mathLab?.update({active:isMathLab(),params:state.params,revealed:hasRun,busy,ready:Boolean(state.results)&&!needsReload});
  if(playback)mathLab?.frame(playback.getState().progress);
  guide?.sync({envelope:state.envelope,params:state.params,revealed:hasRun,blocked:Boolean(buildController)||imageBusy||loading||plannerBusy||conditionPending});
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
  if(prediction){selected=prediction.selectedIndex;$('confidence').value=prediction.confidence;text('confidence-value',prediction.confidence+'%');}
  renderChoices('prediction-options',state.lesson.prediction,index=>{selected=index;text('run-status','Prediction selected · ready to test');setActions();},{selected,disabled:Boolean(prediction)});
  $('confidence').disabled=Boolean(prediction);
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
        controlTimer=setTimeout(()=>runCurrent({animate:isCradleLab(),automaticTutor:false}).catch(handleRunError),100);
      }).catch(error=>showError(error.message)).finally(()=>{if(token===controlEpoch){conditionPending=false;setActions();}});
    });
  }
}
function renderShelf(){
  $('history-list').replaceChildren();
  for(const entry of [starter,newtonCradle,mathStarter,...shelf]){
    const button=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('span');button.type='button';button.className='history-item';button.setAttribute('aria-current',String(entry.id===state.identity.lessonId));title.textContent=entry.lesson.title;meta.textContent=entry.source==='astra'?`${entry.lesson.domain} · ${entry.validation?.runtime?.passed?'Checked':'Saved lesson'}`:entry.source==='curated'?`${entry.catalog.topic} · Reference model`:'Physics · Built-in reference';button.append(title,meta);
    button.addEventListener('click',()=>{cancelBuild();imageInput.cancel();loadLesson(entry).then(()=>{if(currentScreen()==='shelf')showScreen('lab');}).catch(error=>showError(error.message));});$('history-list').append(button);
  }
}
function saveLesson(entry){shelf=[entry,...shelf.filter(x=>x.id!==entry.id)].slice(0,8);try{localStorage.setItem('ml-lessons-v3',JSON.stringify(shelf));}catch{showError('This browser could not save the lesson. It is still available on the workbench.');}renderShelf();}
function resetFollowup(){followupQuestion=state.lesson.followup;text('followup-source','Built-in question');text('reasoning-focus','A new situation to test the idea.');text('followup-prompt',followupQuestion.prompt);text('followup-feedback','');$('next-question').hidden=true;renderFollowupOptions();}
function renderFollowupOptions(){
  renderChoices('followup-options',followupQuestion,index=>{text('followup-feedback',followupQuestion.feedback[index]);tutorHistory.push({role:'user',text:`For the question "${followupQuestion.prompt}", I chose "${followupQuestion.options[index]}".`});tutorHistory=tutorHistory.slice(-10);$('next-question').hidden=false;});
}
async function loadLesson(entry,{preservePinned=false,signal}={}){
  guide?.cancel();
  const token=++lessonEpoch;runEpoch++;controlEpoch++;conditionPending=false;invalidateTutor();clearTimeout(controlTimer);loading=true;setActions();
  await playback?.pause();
  const candidate=new SandboxExperiment($('experiment-container'));
  try{
    await candidate.load(entry.lesson.code,{signal});signal?.throwIfAborted();
    if(token!==lessonEpoch){candidate.destroy();return;}
    state.accept(entry,{preservePinned});await playback?.reset();playbackContext=null;host?.destroy();host=candidate;needsReload=false;selected=null;hasRun=false;tutorHistory=[];
    guide?.end();$('whatif').value='';$('tutor-message').value='';$('transcript').replaceChildren();$('transcript-panel').hidden=true;caption=null;transcripts.clear();$('error').hidden=true;$('experiment-build-error').hidden=true;
    $('experiment-container').hidden=true;$('prediction-cover').hidden=false;$('frame-error').hidden=true;$('explanation').hidden=true;$('followup').hidden=true;$('playback-controls').hidden=true;$('metrics').replaceChildren();$('tutor-messages').replaceChildren();
    $('drop-preview').hidden=entry.source!=='built-in';$('idea-preview').hidden=entry.source==='built-in';
    text('domain',entry.lesson.domain.toUpperCase());text('lesson-title',entry.lesson.title);text('lesson-claim','“'+entry.lesson.claim+'”');text('prediction-prompt',entry.lesson.prediction.prompt);text('source',entry.source==='astra'?`Astra · v${state.version}`:entry.source==='curated'?'Reference model':'Built-in reference');text('visual-title','Your experiment');text('run-status','Make a prediction first');text('summary','What do you expect to happen?');text('run','▶ Run experiment');text('tutor-status',apiReady?'Make a prediction and run the lab to explore together.':'Reference lesson available · AI features need API setup.');text('source-code',entry.lesson.code);text('lesson-meta',entry.source==='astra'?`Generated with GPT-6 Astra · ${new Date(entry.createdAt).toLocaleDateString()}${entry.brief?' · '+entry.brief.grade+' · '+entry.brief.subject:''}`:entry.source==='curated'?`${entry.catalog.topic} · ${entry.catalog.grade} · Original reference model`:'Built-in reference · idealized falling-objects model');
    $('confidence').value=50;text('confidence-value','50%');$('prediction-details').open=true;
    $('assumptions').replaceChildren();for(const assumption of entry.lesson.assumptions){const li=document.createElement('li');li.textContent=assumption;$('assumptions').append(li);}
    renderControls();setPredictionControls();resetFollowup();
    if(isDropLab())text('visual-title','The drop chamber');
    if(isMathLab())text('visual-title','Follow the money');
    if(isCradleLab())text('visual-title','Newton’s cradle');
    $('whatif').placeholder=isMathLab()?'What if the discount were 20%?':isCradleLab()?'What if the cradle lost energy on each swing?':"What if we could change the planet's gravity?";
    text('idea-preview',isMathLab()?'$':'?');
    const checks=entry.validation?.runtime?.runs?.length;
    text('check-summary',checks?`${checks} runs checked · ${entry.validation.repairs} repairs`:entry.source==='built-in'?'Built-in reference':'Saved lesson · checks not recorded');
    renderReceipt(entry.validation?.receipt||[{stage:'reference',status:'passed',detail:entry.source==='built-in'?'Built-in falling-objects reference. Automated browser tests check its vacuum and drag calculations.':'This saved lesson predates recorded checks. Build a new version to check it.'}]);
    renderShelf();
    if(state.pinned){$('comparison').hidden=true;renderComparison(state);}else{baselineHost?.destroy();baselineHost=null;$('baseline-container').replaceChildren();$('comparison').hidden=true;}
    const url=new URL(location.href);entry.source==='astra'?url.searchParams.set('lesson',entry.id):url.searchParams.delete('lesson');history.replaceState({},'',url);syncVoice();
  }catch(error){candidate.destroy();throw error;}
  finally{if(token===lessonEpoch){loading=false;setActions();}}
}
function recordPrediction({selectedIndex=selected,reason='',confidence=Number($('confidence').value)}={},identity=state.identity){
  state.predict({selectedIndex,reason:reason.trim()||'No written reason provided.',confidence},identity);setPredictionControls();setActions();syncVoice();
}
function handleRunError(error){if(error.name==='AbortError')return;debug.journal.add({stage:'sandbox',status:'failed',detail:error.message});needsReload=true;text('frame-error',error.message||'This experiment could not run. Replay to retry.');$('frame-error').hidden=false;text('run-status','Replay to retry the experiment');setActions();}
async function runCurrent({animate=true,automaticTutor=true,signal,walkthrough=false,playUntil=1,playFrom=0}={}){
  signal?.throwIfAborted();if(loading||buildController||conditionPending||plannerBusy||walkthroughBusy&&!walkthrough)throw Error('Wait for the current lab action to finish.');
  if(!state.prediction)recordPrediction();
  const identity=currentIdentity(),params={...state.params},epoch=++runEpoch,first=!hasRun;
  const valid=()=>epoch===runEpoch&&sameIdentity(identity,state.identity)&&!signal?.aborted;
  await playback.reset();if(!valid())return null;
  if(needsReload){await host.load(state.lesson.code,{signal});needsReload=false;}
  $('frame-error').hidden=true;text('run-status','Running the experiment…');
  const viewport={width:Math.max(260,Math.round($('experiment-container').parentElement.clientWidth)),height:isDropLab()||isMathLab()?460:340,progress:1};
  try{
    const result=await host.run(params,viewport,{signal});
    if(!valid())return null;
    state.recordRun(result,{...identity,params,viewport});hasRun=true;if(first)$('prediction-details').open=false;debug.journal.add({stage:'sandbox',status:'passed',detail:`Experiment executed · ${result.metrics.length} measurements returned`});
    $('prediction-cover').hidden=true;$('experiment-container').hidden=false;renderMetrics($('metrics'),result.metrics);text('summary',result.summary);text('run-status','Change a control to test another condition');text('run','↻ Replay experiment');
    if(isDropLab())text('run','↓ Drop again');
    $('explanation').hidden=false;$('followup').hidden=false;
    text('verdict',({misconception:'A BELIEF WORTH REVISING',partly_true:'IT DEPENDS ON THE CONDITIONS',accurate:'YOUR CLAIM HOLDS UP',not_testable:'AN EXPLANATION, NOT A PROOF'})[state.lesson.verdict]);
    text('feedback',state.lesson.prediction.feedback[state.prediction.selectedIndex]);text('explanation-text',state.lesson.explanation);text('conditions-note','Your original prediction was for: '+conditionLabels(state.lesson,state.prediction.params));
    playbackContext={identity,params,viewport,epoch};$('playback-controls').hidden=false;
    $('comparison').hidden=!state.pinned;renderComparison(state);setActions();syncVoice();
    if(animate&&currentScreen()==='lab'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){if(playFrom>0)await playback.seek(playFrom);await playback.playTo(playUntil);}else await playback.seek(playUntil);
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
  try{await candidate.load(lesson.code,{signal});return await preflightLesson(lesson,(params,viewport,options)=>candidate.run(params,viewport,options),{signal,onProgress:({completed,total,check})=>{const detail=`Checking case ${completed} of ${total} · controls and playback`;text('generation-detail',detail);text('experiment-loading-detail',detail);debug.journal.add({stage:'sandbox',status:check.passed?'passed':'failed',detail:`Case ${completed}/${total} · ${check.detail}`});}});}
  finally{candidate.destroy();container.remove();}
}
function cancelBuild(){if(buildController)debug.journal.add({stage:'build',status:'cancelled',detail:'Cancellation requested'});buildEpoch++;buildController?.abort();buildController=null;buildReturnScreen=null;$('generation').hidden=true;setActions();}
$('cancel').addEventListener('click',()=>{const returnTo=buildReturnScreen,restoreFocus=$('experiment-loading').contains(document.activeElement);cancelBuild();buildReturnScreen=null;planner?.cancel();text('run-status',state.prediction?'Your current experiment is still available':'Make a prediction first');if(returnTo&&currentScreen()==='lab')showScreen(returnTo);else if(restoreFocus){$('visual-title').setAttribute('tabindex','-1');$('visual-title').focus({preventScroll:true});}});
$('experiment-loading-cancel').addEventListener('click',()=>$('cancel').click());
function setBuildProgress(title,detail){text('generation-title',title);text('generation-detail',detail);text('experiment-loading-title',title);text('experiment-loading-detail',detail);}
function presentPendingExperiment(question,{revision=false,reference=false}={}){
  text('pending-kind',revision?'YOUR WHAT-IF QUESTION':reference?'OPENING AN EXPERIMENT':'YOUR NEW IDEA');
  text('pending-title',revision?'Let’s explore your “what if”.':reference?'Getting your experiment ready.':'Your idea is becoming an experiment.');
  text('pending-question',question);
  text('experiment-loading-note',revision?'Your previous run is kept for comparison after you try the new experiment.':'You can cancel while this experiment is being prepared.');
  text('experiment-loading-cancel',buildReturnScreen==='create'?'Cancel and edit my idea':buildReturnScreen==='planner'?'Cancel and return to plan':'Cancel and return');
}
async function buildLesson(endpoint,payload,{signal,preservePinned=false}={}){
  if(buildController||imageBusy||tutorBusy)throw Error('Let the current request finish before building another experiment.');
  let accepted=false;
  const origin=currentScreen();buildReturnScreen=origin==='create'||origin==='planner'?origin:null;
  const controller=new AbortController();buildController=controller;const epoch=++buildEpoch;const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  presentPendingExperiment(payload.request||payload.claim,{revision:preservePinned});
  runEpoch++;controlEpoch++;clearTimeout(controlTimer);invalidateTutor();$('generation').hidden=false;$('error').hidden=true;$('experiment-build-error').hidden=true;
  setBuildProgress(preservePinned?'Building your what-if experiment':'Designing your experiment',preservePinned?'Exploring your new condition. Your current experiment is kept while we build.':'Turning your question into an interactive experiment.');setActions();
  showScreen('lab');$('pending-lesson-heading').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});$('experiment-loading-title').setAttribute('tabindex','-1');$('experiment-loading-title').focus({preventScroll:true});
  try{
    await playback.pause();
    combined.throwIfAborted();if(preservePinned&&state.results&&!state.pinned)await pinRun();combined.throwIfAborted();
    const entry=await buildCheckedLesson({endpoint,payload,request,check:checkCandidate,signal:combined,onProgress:(event,receipt)=>{
      if(epoch!==buildEpoch)return;
      debug.journal.add({stage:event.stage,status:event.status,detail:event.detail});
      const titles={build:'Designing your experiment',test:'Testing the generated experiment',review:'Checking the explanation and results',repair:'Repairing the experiment',check:'A check found something to fix',ready:'Your experiment is ready'};
      setBuildProgress(titles[event.stage]||'Checking experiment',event.detail);renderReceipt(receipt||[]);
    }});
    combined.throwIfAborted();if(epoch!==buildEpoch)return null;
    if(preservePinned){entry.version=state.version+1;entry.parentId=state.identity.lessonId;}
    await loadLesson(entry,{preservePinned,signal:combined});
    if(epoch!==buildEpoch)return null;
    saveLesson(entry);accepted=true;
    return {ok:true,...state.read()};
  }catch(error){if(epoch===buildEpoch&&error.name!=='AbortError'){showError(error.message);text('experiment-build-error',error.message+' Your current experiment is still available.');$('experiment-build-error').hidden=false;if(buildReturnScreen&&currentScreen()==='lab')showScreen(buildReturnScreen,{replace:true});if(error.receipt)renderReceipt(error.receipt);}throw error;}
  finally{if(epoch===buildEpoch){buildController=null;buildReturnScreen=null;$('generation').hidden=true;setActions();if(accepted&&currentScreen()==='lab')showScreen('lab',{replace:true});}}
}
$('claim-form').addEventListener('submit',event=>{event.preventDefault();buildLesson('/api/lessons',{claim:$('claim').value.trim()}).catch(()=>{});});
for(const button of document.querySelectorAll('[data-example]'))button.addEventListener('click',()=>{$('claim').value=button.dataset.example;$('claim').focus();});
async function reviseExperiment(message,{signal}={}){
  signal?.throwIfAborted();
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
  if(conditionPending||plannerBusy||loading||imageBusy||buildController||walkthroughBusy)throw Error('Wait for the current lab action to finish.');
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
  setActions();
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
    if(playbackContext===context){dropLab?.frame(progress);mathLab?.frame(progress);}
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
  if(buildController||imageBusy||tutorBusy||loading||walkthroughBusy||conditionPending)throw Error('Let the current request finish first.');
  const controller=new AbortController();buildController=controller;const epoch=++buildEpoch;
  const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  presentPendingExperiment(entry.lesson.claim,{reference:true});
  runEpoch++;controlEpoch++;clearTimeout(controlTimer);$('generation').hidden=false;$('error').hidden=true;$('experiment-build-error').hidden=true;setBuildProgress('Checking the reference experiment','Preparing the controls and checking the calculation.');setActions();
  try{
    await playback.pause();const runtime=await checkCandidate(entry.lesson,{signal:combined});combined.throwIfAborted();
    if(!runtime.passed)throw Error('The reference model did not pass its browser checks. Your current experiment is kept.');
    const receipt=[{stage:'reference',status:'passed',detail:'Original reference model. Its calculations are covered by independently written numerical tests.'},{stage:'test',status:'passed',detail:`${runtime.runs.length} browser execution cases passed across controls, sizes and playback positions.`}];
    await loadLesson({...entry,validation:{runtime,repairs:0,receipt}},{signal:combined});
    if(epoch!==buildEpoch)return null;
    return {ok:true,...state.read()};
  }finally{if(epoch===buildEpoch){buildController=null;$('generation').hidden=true;setActions();}}
}
const imageInput=setupImageInput({request,onClaim:claim=>{$('claim').value=claim;},onError:showError,onBusy:busy=>{imageBusy=busy;setActions();}});
dropLab=setupDropLab({onChange:async patch=>{
  if(!isDropLab()||!state.results||loading||buildController||plannerBusy||imageBusy||conditionPending)return;
  const identity=currentIdentity(),token=++controlEpoch;
  runEpoch++;conditionPending=true;clearTimeout(controlTimer);invalidateTutor();setActions();
  try{
    await playback.reset();if(token!==controlEpoch||!sameIdentity(identity,state.identity))return;
    state.setParams(patch);renderControls();clearChangedResult();renderComparison(state);syncVoice();
  }finally{if(token===controlEpoch){conditionPending=false;setActions();}}
  if(token===controlEpoch&&sameIdentity(identity,state.identity))await runCurrent({animate:true,automaticTutor:false});
},onSeek:async progress=>{await playback.seek(progress);document.querySelector('.experiment-stage').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});},onError:error=>showError(error.message)});
mathLab=setupMathLab({onChange:async patch=>{
  if(!isMathLab()||!state.results||loading||buildController||plannerBusy||imageBusy||conditionPending||walkthroughBusy)return;
  guide?.end();
  const identity=currentIdentity(),token=++controlEpoch;runEpoch++;conditionPending=true;clearTimeout(controlTimer);invalidateTutor();setActions();
  try{
    await playback.reset();if(token!==controlEpoch||!sameIdentity(identity,state.identity))return;
    state.setParams(patch);renderControls();clearChangedResult();renderComparison(state);syncVoice();
  }finally{if(token===controlEpoch){conditionPending=false;setActions();}}
  if(token===controlEpoch&&sameIdentity(identity,state.identity))await runCurrent({animate:true,automaticTutor:false});
},onSeek:async progress=>{guide?.end();await playback.seek(progress);document.querySelector('.experiment-stage').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});},onError:error=>showError(error.message)});
guide=setupWalkthrough({onBusy:busy=>{walkthroughBusy=busy;setActions();},onError:error=>debug.journal.add({stage:'walkthrough',status:'failed',detail:error.message}),onPrepare:async(recipe,envelope,{signal})=>{
  invalidateTutor();await playback.pause();signal.throwIfAborted();
  const container=document.createElement('div');$('preflight-container').append(container);const checking=new SandboxExperiment(container);
  const steps=[];
  try{
    await checking.load(envelope.lesson.code,{signal});
    for(const step of recipe.steps){const result=await checking.run(step.params,{width:720,height:460,progress:1},{signal});steps.push({id:step.id,title:step.title,focus:step.focus,params:step.params,progress:step.progress,results:{metrics:result.metrics,summary:result.summary}});}
  }finally{checking.destroy();container.remove();}
  const reference={source:'Reference explanation · checked local experiment',steps:recipe.steps};
  if(!apiReady)return reference;
  try{const response=await request('/api/walkthrough',{lesson:envelope.lesson,steps,...(envelope.brief?{brief:envelope.brief}:{})},{signal});return {...response,source:'Astra explanation · checked local experiment'};}
  catch(error){signal.throwIfAborted();return {...reference,source:'Astra unavailable · using the reference explanation'};}
},onStep:async(step,{signal})=>{
  const identity=currentIdentity(),token=++controlEpoch;runEpoch++;conditionPending=true;clearTimeout(controlTimer);invalidateTutor();setActions();
  try{await playback.reset();signal.throwIfAborted();if(token!==controlEpoch||!sameIdentity(identity,state.identity))throw new DOMException('Experiment changed.','AbortError');state.setParams(step.params);renderControls();clearChangedResult();renderComparison(state);syncVoice();}
  finally{if(token===controlEpoch){conditionPending=false;setActions();}}
  const result=await runCurrent({animate:true,automaticTutor:false,signal,walkthrough:true,playUntil:step.progress,playFrom:step.from??0});if(!result?.ok)throw Error('The walkthrough could not run this step.');
}});
planner=setupPlanner({request,onBuild:(payload,options)=>buildLesson('/api/lessons',payload,options),onOpenStarter:openStarter,onBusy:busy=>{plannerBusy=busy;setActions();},isLabBusy:()=>Boolean(buildController)||loading||imageBusy||tutorBusy||conditionPending||walkthroughBusy});
let resizeTimer;
function refreshVisibleExperiment(){if(hasRun&&currentScreen()==='lab'&&!loading&&!buildController&&!plannerBusy&&!conditionPending&&!walkthroughBusy)runCurrent({animate:false,automaticTutor:false,playUntil:playback.getState().progress}).catch(handleRunError);}
addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refreshVisibleExperiment,200);});
addEventListener('workspacechange',event=>{if(event.detail==='experiment'){clearTimeout(resizeTimer);resizeTimer=setTimeout(refreshVisibleExperiment,0);}else playback.pause();});
addEventListener('pagehide',()=>{cancelBuild();planner?.cancel();guide?.cancel();invalidateTutor();playback.destroy().then(()=>host?.destroy());baselineHost?.destroy();live.stop();});
setupFlow({onLeaveLab:()=>{clearTimeout(resizeTimer);guide?.cancel();playback.pause();live.stop().catch(error=>text('voice-status',error.message));}});
const initial=shelf.find(x=>x.id===new URL(location.href).searchParams.get('lesson'))||starter;
loadLesson(initial).catch(async error=>{showError(error.message);if(initial!==starter)await loadLesson(starter).catch(fallback=>showError(fallback.message));});
fetch('/api/status').then(r=>r.json()).then(data=>{apiReady=Boolean(data.ready);text('connection',apiReady?'API key configured':'API setup needed');$('connection').dataset.ready=String(apiReady);text('tutor-status',apiReady?'Make a prediction and run the lab to explore together.':'Built-in lesson available · AI features need API setup.');}).catch(()=>text('connection','Server unavailable'));

$('try-starter').addEventListener('click',()=>loadLesson(starter).then(()=>{if(currentScreen()==='choose')showScreen('lab');}).catch(error=>showError(error.message)));
for(const [id,entry]of [['try-math',mathStarter],['try-cradle',newtonCradle]])$(id).addEventListener('click',async()=>{try{const result=await openStarter(entry);if(result?.ok&&currentScreen()==='choose')showScreen('lab');}catch(error){if(error.name!=='AbortError')showError(error.message);}});
