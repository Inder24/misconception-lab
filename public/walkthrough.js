import {demoWalkthrough} from './demo-walkthroughs.js';

export function setupWalkthrough({onPrepare,onStep,onBusy,onError}){
 const $=id=>document.getElementById(id);
 let recipe=null,lesson=null,index=-1,narrations=null,busy=false,externalBusy=false,controller=null,epoch=0,expected=null;
 function controls(){
  $('guide-start').hidden=index>=0;$('guide-navigation').hidden=index<0;
  for(const button of $('guided-walkthrough').querySelectorAll('button'))button.disabled=busy||externalBusy;
  $('guide-back').disabled=busy||externalBusy||index<=0;
  $('guide-next').disabled=busy||externalBusy||!recipe||index>=recipe.steps.length-1;
  $('guide-next').textContent=recipe&&index===recipe.steps.length-1?'Complete ✓':'Next step →';
  $('guide-cancel').hidden=!busy;$('guide-cancel').disabled=!busy;
 }
 function reset(){index=-1;narrations=null;expected=null;$('guide-error').hidden=true;$('guide-error').textContent='';$('guide-title').textContent='See the explanation happen.';$('guide-narration').textContent=recipe?.intro||'';$('guide-count').textContent='STEP BY STEP';$('guide-source').textContent='Your partner + the experiment';controls();}
 function cancel(){epoch++;controller?.abort();controller=null;busy=false;onBusy(false);controls();}
 async function operate(action){
  if(busy||externalBusy)return;
  const token=++epoch;controller=new AbortController();const signal=controller.signal;
  busy=true;onBusy(true);controls();$('guide-error').hidden=true;
  try{await action(signal,()=>token===epoch&&!signal.aborted);}
  catch(error){if(token===epoch&&error.name!=='AbortError'){$('guide-error').textContent=error.message;$('guide-error').hidden=false;onError(error);}}
  finally{if(token===epoch){controller=null;busy=false;onBusy(false);controls();}}
 }
 async function showStep(next,signal,current){
  const step=recipe.steps[next];expected=JSON.stringify(step.params);
  await onStep(step,{signal});if(!current())return;
  index=next;$('guide-count').textContent=`STEP ${index+1} OF ${recipe.steps.length}`;$('guide-title').textContent=step.title;
  $('guide-narration').textContent=narrations.steps[index].narration;controls();
 }
 $('guide-start').addEventListener('click',()=>operate(async(signal,current)=>{
  $('guide-source').textContent='Checking the steps and preparing an explanation…';
  const result=await onPrepare(recipe,lesson,{signal});if(!current())return;narrations=result;
  $('guide-source').textContent=result.source;
  await showStep(0,signal,current);
  $('lesson-title').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 }));
 for(const [id,offset]of [['guide-back',-1],['guide-next',1],['guide-replay',0]])$(id).addEventListener('click',()=>operate((signal,current)=>showStep(index+offset,signal,current)));
 $('guide-cancel').addEventListener('click',()=>{cancel();$('guide-source').textContent='Walkthrough paused. Your experiment is still available.';});
 function sync({envelope,params,revealed,blocked}){
  externalBusy=blocked;
  if(lesson?.id!==envelope.id||lesson?.version!==envelope.version||lesson?.lesson.code!==envelope.lesson.code){
   if(busy){epoch++;controller?.abort();controller=null;busy=false;onBusy(false);}
   lesson=envelope;recipe=demoWalkthrough(envelope);reset();
  }
  $('guided-walkthrough').hidden=!recipe||!revealed;
  if(!busy&&index>=0&&expected!==JSON.stringify(params)){reset();$('guide-source').textContent='Conditions changed. Start again to follow the guided steps.';}
  controls();
 }
 return {sync,cancel,end(){cancel();reset();}};
}
