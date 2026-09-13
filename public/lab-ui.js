export const $=id=>document.getElementById(id);
export const text=(id,value)=>{$(id).textContent=value??'';};
export function renderChoices(id,question,onChoose,{selected=null,disabled=false}={}){
  $(id).replaceChildren();
  question.options.forEach((label,index)=>{const button=document.createElement('button');button.type='button';button.className='choice';button.textContent=label;button.disabled=disabled;button.setAttribute('aria-pressed',String(index===selected));button.addEventListener('click',()=>{for(const other of $(id).children)other.setAttribute('aria-pressed',String(other===button));onChoose(index);});$(id).append(button);});
}
export function renderMetrics(container,metrics){
  container.replaceChildren();
  for(const metric of metrics){const div=document.createElement('div');div.className='metric';const label=document.createElement('span'),value=document.createElement('strong');label.textContent=metric.label;value.textContent=metric.value;div.append(label,value);container.append(div);}
}
export function renderReceipt(receipt){
  $('receipt').replaceChildren();
  for(const event of receipt){const li=document.createElement('li');li.dataset.status=event.status||'running';li.textContent=event.detail;const small=document.createElement('small');small.textContent=[event.stage,event.attempt?`revision attempt ${event.attempt}`:'',event.at?new Date(event.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''].filter(Boolean).join(' · ');li.append(small);$('receipt').append(li);}
}
export function addMessage(container,role,message){
  const box=document.createElement('div');box.className='chat-message';box.dataset.role=role;const label=document.createElement('small');label.textContent=role==='user'?'You':'Lab partner';box.append(label,document.createTextNode(message));container.append(box);return box;
}
export function showError(message){text('error',message);$('error').hidden=false;}
export function conditionLabels(lesson,params){return lesson.controls.map(c=>`${c.label}: ${params[c.id]}${c.unit?' '+c.unit:''}`).join(' · ')||'No adjustable controls';}
export function renderComparison(state){
  const pin=state.pinned;if(!pin)return;
  text('baseline-title',`${pin.title} · v${pin.version}`);text('baseline-params',conditionLabels(pin.lesson,pin.params));
  text('comparison-status',`${state.lesson.title} · v${state.version} · ${conditionLabels(state.lesson,state.params)}`);
  $('comparison-results').replaceChildren();
  if(!state.results){text('comparison-summary','Run the current conditions to compare the outcomes.');return;}
  const table=document.createElement('table'),head=document.createElement('thead'),row=document.createElement('tr');
  for(const name of ['Measurement','A · Pinned','B · Current']){const th=document.createElement('th');th.scope='col';th.textContent=name;row.append(th);}head.append(row);table.append(head);
  const body=document.createElement('tbody'),labels=[...new Set([...pin.results.metrics,...state.results.metrics].map(x=>x.label))];
  for(const label of labels){const row=document.createElement('tr');for(const value of [label,pin.results.metrics.find(x=>x.label===label)?.value??'—',state.results.metrics.find(x=>x.label===label)?.value??'—']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}table.append(body);$('comparison-results').append(table);
  text('comparison-summary',pin.lessonId!==state.identity.lessonId||pin.version!==state.version?'Different lesson versions. Compare their assumptions as well as the measurements.':state.results.summary);
}
