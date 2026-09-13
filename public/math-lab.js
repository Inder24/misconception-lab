import {percentageState} from './math-starter.js';

export function setupMathLab({onChange,onSeek,onError}){
 const $=id=>document.getElementById(id),form=$('math-input-form');
 const fields={initial_amount:'math-amount',discount:'math-discount',increase:'math-increase'};
 let enabled=false,current=null,lastParams='',restoreFocus=null,dirty=false;
 const money=value=>'$'+value.toFixed(2);
 function dirtyNote(){dirty=true;$('math-edit-status').textContent='Your edits are ready. Try them to update the experiment.';}
 for(const name of ['discount','increase']){
  const number=$('math-'+name),range=$('math-'+name+'-range');
  range.addEventListener('input',()=>{number.value=range.value;dirtyNote();});
  number.addEventListener('input',()=>{if(number.validity.valid)range.value=number.value;dirtyNote();});
 }
 $('math-amount').addEventListener('input',dirtyNote);
 async function apply(patch){
  if(!enabled)return;
  try{await onChange(patch);dirty=false;$('math-edit-status').textContent='Your numbers are running. Inspect any step below.';}
  catch(error){onError(error);}
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();if(!form.reportValidity())return;
  apply(Object.fromEntries(Object.entries(fields).map(([name,id])=>[name,$(id).valueAsNumber])));
 });
 for(const button of document.querySelectorAll('[data-math-preset]'))button.addEventListener('click',()=>{
  if(!enabled||!$('math-amount').reportValidity())return;
  const [discount,increase]=button.dataset.mathPreset.split(',').map(Number);
  apply({initial_amount:$('math-amount').valueAsNumber,discount,increase});
 });
 for(const button of document.querySelectorAll('[data-math-stage]'))button.addEventListener('click',()=>{
  if(enabled)Promise.resolve(onSeek(Number(button.dataset.mathStage))).catch(onError);
 });
 function update({active,params,revealed,busy,ready}){
  current=params;enabled=active&&revealed&&!busy&&ready;
  document.querySelector('.workbench').classList.toggle('math-workbench',active);
  $('math-editor').hidden=!active;$('math-inspector').hidden=!active||!revealed;
  if(!enabled&&document.activeElement?.closest('#math-editor'))restoreFocus=document.activeElement.id||null;
  for(const root of [$('math-editor'),$('math-inspector')])for(const input of root.querySelectorAll('button,input'))input.disabled=!enabled;
  if(!active){lastParams='';restoreFocus=null;dirty=false;return;}
  if(enabled&&restoreFocus){if(document.activeElement===document.body)$(restoreFocus)?.focus({preventScroll:true});restoreFocus=null;}
  const key=JSON.stringify(params);
  if(key!==lastParams){
   lastParams=key;dirty=false;for(const [name,id]of Object.entries(fields))$(id).value=params[name];
   for(const name of ['discount','increase'])$('math-'+name+'-range').value=params[name];
  }
  if(!dirty)$('math-edit-status').textContent=!revealed?'Make your prediction to unlock your own numbers.':busy?'Applying the experiment settings…':'Change the numbers, then try your experiment.';
  for(const button of document.querySelectorAll('[data-math-preset]')){const [discount,increase]=button.dataset.mathPreset.split(',').map(Number);button.setAttribute('aria-pressed',String(params.discount===discount&&params.increase===increase));}
  $('math-outcome').hidden=!ready;
  if(!revealed||!ready)return;
  const result=percentageState(params),net=result.final-result.initial,tie=Math.abs(net)<1e-8;
  $('math-outcome').dataset.kind=tie?'equal':net<0?'below':'above';
  $('math-outcome-amount').textContent=tie?'Back to '+money(result.initial):money(Math.abs(net))+(net<0?' below your start':' above your start');
  $('math-outcome-reason').textContent=`The discount takes ${money(result.discountAmount)} from ${money(result.initial)}. The increase adds ${money(result.increaseAmount)} to the discounted ${money(result.afterDiscount)} base.`;
 }
 function frame(progress){
  if(!enabled||!current)return;
  const stage=progress===0?0:progress<=.5?.5:1;
  $('math-phase').textContent=progress===0?'The starting price':progress<.5?'Taking the discount…':progress===.5?'The discounted price':progress<1?'Adding the increase…':'The final price';
  for(const button of document.querySelectorAll('[data-math-stage]'))button.setAttribute('aria-pressed',String(Number(button.dataset.mathStage)===stage));
 }
 return {update,frame};
}
