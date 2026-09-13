import {validateLesson} from './lesson-schema.js';
const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const text=(v,max)=>typeof v==='string'&&v.length<=max;
export function validateExperimentResult(result,{requireMarks=false}={}){
 if(!result||!Array.isArray(result.marks)||result.marks.length>300||(requireMarks&&!result.marks.length))throw Error('Expected 1–300 drawing marks.');
 const number=(m,key,min=-2000,max=4000)=>{if(!bounded(m[key],min,max))throw Error(`Invalid or nonfinite ${m.type} ${key}.`);};
 for(const m of result.marks){
  if(!m||!['circle','rect','line','text','polyline'].includes(m.type))throw Error('Unknown drawing mark type.');
  if(m.color!==undefined&&!(typeof m.color==='string'&&/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(m.color)))throw Error('Invalid drawing color.');
  if(m.width!==undefined)number(m,'width',1,10);
  if(m.type==='polyline'){
   if(!Array.isArray(m.points)||m.points.length<2||m.points.length>500)throw Error('Polyline needs 2–500 points.');
   for(const p of m.points){if(!p)throw Error('Invalid polyline point.');number(p,'x');number(p,'y');}continue;
  }
  number(m,'x');number(m,'y');
  if(m.type==='circle')number(m,'r',0,1000);
  if(m.type==='rect'){number(m,'w',0,2000);number(m,'h',0,2000);}
  if(m.type==='line'){number(m,'x2');number(m,'y2');}
  if(m.type==='text'){
   if(!text(m.text,160))throw Error('Invalid drawing text.');
   if(m.size!==undefined)number(m,'size',12,36);
   if(m.align!==undefined&&!['left','center','right'].includes(m.align))throw Error('Invalid text alignment.');
  }
 }
 if(!Array.isArray(result.metrics)||result.metrics.length<1||result.metrics.length>4||result.metrics.some(m=>!m||!text(m.label,80)||!m.label.trim()||!text(m.value,100)||!m.value.trim()))throw Error('Expected one to four nonempty labeled text metrics.');
 if(!text(result.summary,600)||!result.summary.trim())throw Error('Expected a plain text result summary.');
 return result;
}
export function validateControlValue(control,value){
 if(!bounded(value,control.min,control.max))throw Error(`${control.id} must be finite and between ${control.min} and ${control.max}.`);
 const steps=(value-control.min)/control.step;
 if(!Number.isFinite(steps)||Math.abs(steps-Math.round(steps))>1e-6)throw Error(`${control.id} must follow step ${control.step} from ${control.min}.`);
 return value;
}
export function validateControls(lesson){
 if(!validateLesson(lesson))throw Error('Lesson structure or control bounds are invalid.');
 for(const c of lesson.controls){validateControlValue(c,c.initial);validateControlValue(c,c.max);}
}
export function buildTestMatrix(lesson){
 validateControls(lesson);
 const initial=Object.fromEntries(lesson.controls.map(c=>[c.id,c.initial]));
 const params=[initial,...['min','max'].map(bound=>Object.fromEntries(lesson.controls.map(c=>[c.id,c[bound]]))),...lesson.controls.flatMap(c=>[c.min,c.max].map(value=>({...initial,[c.id]:value})))];
 const unique=[...new Map(params.map(p=>[JSON.stringify(p),p])).values()];
 return unique.flatMap(params=>[320,720].flatMap(width=>[0,.5,1].map(progress=>({params:{...params},viewport:{width,height:340,progress}}))));
}
export async function preflightLesson(lesson,run,{signal,onProgress}={}){
 const aborted=()=>{if(signal?.aborted)throw signal.reason||new DOMException('Canceled','AbortError');};
 aborted();let matrix;
 try{matrix=buildTestMatrix(lesson);}catch(error){return {passed:false,checks:[{name:'Control and lesson validation',passed:false,detail:error.message}],runs:[]};}
 const checks=[],runs=[];
 for(const [index,item] of matrix.entries()){
  aborted();const name=`Sandbox run ${index+1}`;const conditions=`params=${JSON.stringify(item.params)}, viewport=${JSON.stringify(item.viewport)}`;
  try{
   const result=await run({...item.params},{...item.viewport},{signal});aborted();validateExperimentResult(result,{requireMarks:true});
   checks.push({name,passed:true,detail:`Rendered ${result.marks.length} valid marks; ${conditions}`});
   runs.push(structuredClone({...item,metrics:result.metrics,summary:result.summary}));
  }catch(error){
   aborted();if(error.name==='AbortError')throw error;
   checks.push({name,passed:false,detail:`${error.message||'Sandbox execution failed'}; ${conditions}`});
   onProgress?.({completed:index+1,total:matrix.length,check:checks.at(-1)});
   // A runtime error terminates its worker. Repair this cause in a fresh sandbox;
   // further calls would only repeat "not ready" and obscure the useful evidence.
   return {passed:false,checks,runs};
  }
  onProgress?.({completed:index+1,total:matrix.length,check:checks.at(-1)});
 }
 return {passed:checks.every(c=>c.passed),checks,runs};
}
