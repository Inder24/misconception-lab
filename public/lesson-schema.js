const str={type:'string'},num={type:'number'};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const question=object({prompt:str,options:{type:'array',items:str},correctIndex:{type:'integer'},feedback:{type:'array',items:str}});
export const lessonSchema=object({title:str,domain:str,claim:str,verdict:{type:'string',enum:['misconception','partly_true','accurate','not_testable']},explanation:str,assumptions:{type:'array',items:str},controls:{type:'array',items:object({id:str,label:str,min:num,max:num,step:num,initial:num,unit:str})},prediction:question,followup:question,code:str});
const s=(v,n=1600)=>typeof v==='string'&&v.length>0&&v.length<=n;
function validQuestion(q){return q&&s(q.prompt,500)&&Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=4&&q.options.every(v=>s(v,240))&&Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<q.options.length&&Array.isArray(q.feedback)&&q.feedback.length===q.options.length&&q.feedback.every(v=>s(v,1200));}
export function validateLesson(x){
 if(!x||!s(x.title,100)||!s(x.domain,80)||!s(x.claim,600)||!['misconception','partly_true','accurate','not_testable'].includes(x.verdict)||!s(x.explanation,2400)||!s(x.code,16000))return false;
 if(!Array.isArray(x.assumptions)||x.assumptions.length<1||x.assumptions.length>6||!x.assumptions.every(v=>s(v,500)))return false;
 if(!Array.isArray(x.controls)||x.controls.length>4)return false;
 const ids=new Set();
 for(const c of x.controls){
  if(!c||!s(c.id,32)||!/^[a-z][a-z0-9_]*$/.test(c.id)||['constructor','prototype','__proto__'].includes(c.id)||ids.has(c.id)||!s(c.label,80)||typeof c.unit!=='string'||c.unit.length>25)return false;
  if(![c.min,c.max,c.step,c.initial].every(Number.isFinite)||c.min>=c.max||c.step<=0||c.step>c.max-c.min||c.initial<c.min||c.initial>c.max||Math.max(Math.abs(c.min),Math.abs(c.max))>1e9)return false;
  ids.add(c.id);
 }
 return validQuestion(x.prediction)&&validQuestion(x.followup);
}
