import {prepareImage} from './image-input.js';
import {validateBrief,validatePlan,validateBriefImport} from './planner-schema.js';
import {experimentStarters} from './experiment-starters.js';

const $=id=>document.getElementById(id);
const fields={topic:'brief-topic',grade:'brief-grade',subject:'brief-subject',learningGoal:'brief-goal',observedBeliefs:'brief-beliefs',includeQuickChecks:'brief-checks'};
const fieldNames={topic:'Topic',grade:'Grade',subject:'Subject',learningGoal:'Learning goal',observedBeliefs:'Observed beliefs',includeQuickChecks:'Quick questions'};
const element=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content)node.textContent=content;return node;};

export function showWorkspace(name,{focus=false}={}){
  for(const id of ['experiment','planner']){
    const active=id===name,tab=$('tab-'+id);
    tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$('panel-'+id).hidden=!active;
    if(active&&focus)tab.focus();
  }
  dispatchEvent(new CustomEvent('workspacechange',{detail:name}));
}

export function setupPlanner({request,onBuild,onOpenStarter,onBusy,isLabBusy}){
  let busy=false,externalBusy=false,controller=null,epoch=0;
  const fieldEdits=Object.fromEntries(Object.keys(fields).map(name=>[name,0]));
  function readBrief(){return Object.fromEntries(Object.entries(fields).map(([name,id])=>[name,name==='includeQuickChecks'?$(id).checked:$(id).value.trim()]));}
  function update(){
    for(const control of $('panel-planner').querySelectorAll('button:not(#planner-cancel):not(#remove-brief-image),input[type=file]'))control.disabled=busy||externalBusy;
    $('planner-cancel').hidden=!busy;
  }
  function cancel(){epoch++;controller?.abort();controller=null;busy=false;onBusy(false);update();}
  async function operate(message,action){
    if(busy||isLabBusy()){return;}
    const id=++epoch;controller=new AbortController();const signal=controller.signal;
    busy=true;onBusy(true);update();$('planner-error').hidden=true;$('planner-status').textContent=message;
    try{await action(signal,()=>id===epoch&&!signal.aborted);}
    catch(error){if(id===epoch&&error.name!=='AbortError'){$('planner-error').textContent=error.message||'The request could not finish. Please try again.';$('planner-error').hidden=false;$('planner-status').textContent='Your brief and current experiment are still available.';if($('brief-uncertainty').textContent==='Interpreting the screenshot…')$('brief-uncertainty').textContent='No context was imported. You can enter it in the fields below.';}}
    finally{if(id===epoch){controller=null;busy=false;onBusy(false);update();}}
  }
  for(const [name,id]of Object.entries(fields))$(id).addEventListener('input',()=>fieldEdits[name]++);
  for(const name of ['experiment','planner']){
    const tab=$('tab-'+name);
    tab.addEventListener('click',()=>showWorkspace(name));
    tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'experiment':event.key==='End'?'planner':name==='experiment'?'planner':'experiment';showWorkspace(next,{focus:true});});
  }
  $('planner-cancel').addEventListener('click',()=>{cancel();$('planner-status').textContent='Request cancelled. Your edits are kept.';});
  $('planner-form').addEventListener('submit',event=>{
    event.preventDefault();const brief=readBrief();if(!validateBrief(brief)){$('planner-error').textContent='Add a topic, grade and subject within the field limits.';$('planner-error').hidden=false;return;}
    operate('Finding a few testable beliefs for your class…',async(signal,current)=>{
      const result=await request('/api/plan',{brief},{signal});if(!current())return;
      if(!validatePlan(result))throw Error('The lesson plan could not be read. Please try again.');
      renderIdeas(result.cards,brief);$('planner-status').textContent='Choose a belief below. You can edit its claim before building.';
      $('planner-results').scrollIntoView({behavior:'smooth',block:'start'});
    });
  });
  function renderIdeas(cards,brief){
    $('misconception-cards').replaceChildren();$('planner-results').hidden=false;
    $('planner-results-context').textContent=`${brief.topic} · ${brief.grade} · ${brief.subject}. These ideas use the brief submitted above; later edits apply when you find experiments again.`;
    cards.forEach((card,index)=>{
      const item=element('article','misconception-card'),form=element('form'),label=element('label',null,'Editable claim'),claim=element('textarea');
      claim.id=`planned-claim-${index}`;claim.rows=3;claim.required=true;claim.minLength=8;claim.maxLength=600;claim.value=card.claim;label.htmlFor=claim.id;label.append(claim);
      item.append(element('p','eyebrow',`IDEA ${String(index+1).padStart(2,'0')}`));
      claim.className='card-claim';form.append(label);
      const editable=(key,title,max,rows=2)=>{const label=element('label',null,title),input=element('textarea');input.rows=rows;input.maxLength=max;input.required=true;input.value=card[key];input.id=`planned-${key}-${index}`;label.htmlFor=input.id;label.append(input);return {label,input};};
      const proposal=editable('experiment','Proposed experiment',600,3);form.append(proposal.label);
      const details=element('details','card-details');details.append(element('summary',null,'Customize the question and reasoning'));
      const rationale=editable('rationale','Reasoning to explore',500),variable=editable('variable','Variable to change',100,1),quick=editable('quickCheck','Quick question',500);
      details.append(rationale.label,variable.label);if(brief.includeQuickChecks)details.append(quick.label);form.append(details);
      const button=element('button','primary','Build this experiment ↗');button.type='submit';form.append(button);item.append(form);$('misconception-cards').append(item);
      form.addEventListener('submit',event=>{event.preventDefault();const edited=claim.value.trim();if(edited.length<8){claim.setCustomValidity('Write a claim with at least eight non-space characters.');claim.reportValidity();return;}claim.setCustomValidity('');
        operate('Building and checking your selected experiment…',async(signal,current)=>{
          const result=await onBuild({claim:edited,brief,experimentRequest:`${proposal.input.value.trim()}\nChange: ${variable.input.value.trim()}\nReasoning to explore: ${rationale.input.value.trim()}${brief.includeQuickChecks?'\nDiagnostic question: '+quick.input.value.trim():''}`},{signal});
          if(current()&&result?.ok){$('planner-status').textContent='Your experiment is ready in the Experiment tab.';showWorkspace('experiment');$('lesson-title').setAttribute('tabindex','-1');$('lesson-title').focus({preventScroll:true});$('lesson-title').scrollIntoView({behavior:'smooth',block:'start'});}
        });
      });
      claim.addEventListener('input',()=>claim.setCustomValidity(''));
    });update();
  }
  $('brief-image-input').addEventListener('change',event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    const edits={...fieldEdits};
    operate('Reading the teaching context in your screenshot…',async(signal,current)=>{
      const image=await prepareImage(file);if(!current())return;
      $('brief-image-panel').hidden=false;$('brief-image-preview').src=image;$('brief-image-regions').replaceChildren();$('brief-region-list').replaceChildren();$('brief-uncertainty').textContent='Interpreting the screenshot…';
      const result=await request('/api/import-brief',{image},{signal});if(!current())return;
      if(!validateBriefImport(result))throw Error('The screenshot interpretation could not be read. Please try again.');
      let kept=0;
      for(const [name,id]of Object.entries(fields)){if(edits[name]!==fieldEdits[name]){kept++;continue;}if(name==='includeQuickChecks')$(id).checked=result.brief[name];else $(id).value=result.brief[name];}
      for(const [index,r]of result.regions.entries()){
        const region=element('div','image-region');Object.assign(region.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'});region.append(element('span',null,String(index+1)));region.title=r.label;$('brief-image-regions').append(region);
        $('brief-region-list').append(element('li',null,`${fieldNames[r.field]||r.field}: ${r.label}`));
      }
      $('brief-uncertainty').textContent=result.uncertainty;
      $('planner-status').textContent=kept?'Screenshot imported. Your newer field edits were kept. Review the brief before finding experiments.':'Screenshot imported. Review the fields, then find experiments.';
    });
  });
  $('remove-brief-image').addEventListener('click',()=>{cancel();$('brief-image-panel').hidden=true;$('brief-image-preview').removeAttribute('src');$('brief-image-regions').replaceChildren();$('brief-region-list').replaceChildren();$('planner-status').textContent='Image removed. Your editable teaching brief is kept.';});
  for(const entry of experimentStarters){
    const item=element('article','starter-card'),art=element('div','starter-art');art.setAttribute('aria-hidden','true');
    // Original, fixed geometric thumbnails; model output never enters markup.
    art.innerHTML=entry.id==='curated-newton-cradle'?'<svg viewBox="0 0 320 125"><rect width="320" height="125" rx="12" fill="#101d36"/><path d="M54 108V20h212v88M96 22l-32 52M128 22v61M160 22v61M192 22v61M224 22v61" fill="none" stroke="#9badc9" stroke-width="2"/><g fill="#cbd9eb"><circle cx="128" cy="86" r="16"/><circle cx="160" cy="86" r="16"/><circle cx="192" cy="86" r="16"/><circle cx="224" cy="86" r="16"/></g><circle cx="64" cy="77" r="16" fill="#ffd479"/><path d="M50 110h222" stroke="#637d9f" stroke-width="5"/></svg>':entry.catalog.topic.toLowerCase().includes('buoy')?'<svg viewBox="0 0 320 125"><path d="M58 38v65h204V38" fill="none" stroke="#789789" stroke-width="2"/><path d="M59 66h202v36H59z" fill="#b6d1df"/><path d="M126 36h56v53h-56z" fill="#b38a58"/><path d="M154 17v14m-5-6 5 6 5-6" fill="none" stroke="#285f42" stroke-width="2"/><path d="M154 115v-18m-5 6 5-6 5 6" fill="none" stroke="#4d80ad" stroke-width="2"/></svg>':'<svg viewBox="0 0 320 125"><path d="M25 70h270" stroke="#a1b2a4"/><path d="M160 15q-26 48 0 94 26-46 0-94z" fill="#b6d6cf" stroke="#699489"/><path d="M58 70V37m-5 7 5-7 5 7" fill="none" stroke="#285f42" stroke-width="3"/><path d="M58 37h102l102 67M58 37l204 67" fill="none" stroke="#b48644" stroke-width="1.5"/><circle cx="113" cy="70" r="2" fill="#285f42"/><circle cx="207" cy="70" r="2" fill="#285f42"/></svg>';
    const body=element('div','starter-card-body'),tags=element('div','starter-tags');tags.append(element('span',null,entry.catalog.grade),element('span',null,'Reference model'));
    body.append(tags,element('h3',null,entry.lesson.title),element('p','small-note',entry.catalog.description));
    const button=element('button','secondary','Open '+entry.catalog.topic+' lab ↗');button.type='button';body.append(button);item.append(art,body);$('starter-cards').append(item);
    button.addEventListener('click',()=>operate('Checking the reference experiment…',async(signal,current)=>{const result=await onOpenStarter(entry,{signal});if(current()&&result?.ok){$('planner-status').textContent='The reference lab is ready. Make a prediction to begin.';showWorkspace('experiment');$('lesson-title').setAttribute('tabindex','-1');$('lesson-title').focus({preventScroll:true});$('lesson-title').scrollIntoView({behavior:'smooth',block:'start'});}}));
  }
  update();return {setBusy(value){externalBusy=Boolean(value);update();},cancel};
}
