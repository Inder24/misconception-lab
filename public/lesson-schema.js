const str={type:'string'},num={type:'number'};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const question=object({prompt:str,options:{type:'array',items:str},correctIndex:{type:'integer'},feedback:{type:'array',items:str}});
export const lessonSchema=object({title:str,domain:str,claim:str,verdict:{type:'string',enum:['misconception','partly_true','accurate','not_testable']},explanation:str,assumptions:{type:'array',minItems:1,maxItems:6,items:{type:'string',minLength:1,maxLength:500}},controls:{type:'array',items:object({id:str,label:str,min:num,max:num,step:num,initial:num,unit:str})},prediction:question,followup:question,code:str});
const s=(v,n=1600)=>typeof v==='string'&&v.length>0&&v.length<=n;
function validQuestion(q){return q&&s(q.prompt,500)&&Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=4&&q.options.every(v=>s(v,240))&&Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<q.options.length&&Array.isArray(q.feedback)&&q.feedback.length===q.options.length&&q.feedback.every(v=>s(v,1200));}
export function lessonValidationIssues(x){
 if(!x)return ['lesson: missing object'];
 for(const [field,limit] of Object.entries({title:100,domain:80,claim:600,explanation:2400,code:16000})){if(!s(x[field],limit))return [`${field}: expected 1–${limit} characters`];}
 if(!['misconception','partly_true','accurate','not_testable'].includes(x.verdict))return ['verdict: unsupported value'];
 if(!Array.isArray(x.assumptions)||x.assumptions.length<1||x.assumptions.length>6||!x.assumptions.every(v=>s(v,500)))return ['assumptions: expected 1–6 entries, each 1–500 characters'];
 if(!Array.isArray(x.controls)||x.controls.length>4)return ['controls: expected at most 4 controls'];
 const ids=new Set();
 for(const c of x.controls){
  if(!c||!s(c.id,32)||!/^[a-z][a-z0-9_]*$/.test(c.id)||['constructor','prototype','__proto__'].includes(c.id)||ids.has(c.id)||!s(c.label,80)||typeof c.unit!=='string'||c.unit.length>25)return ['controls: invalid or duplicate id, label, or unit'];
  if(![c.min,c.max,c.step,c.initial].every(Number.isFinite)||c.min>=c.max||c.step<=0||c.step>c.max-c.min||c.initial<c.min||c.initial>c.max||Math.max(Math.abs(c.min),Math.abs(c.max))>1e9)return ['controls: invalid numeric bounds, step, or initial value'];
  ids.add(c.id);
 }
 return [...(!validQuestion(x.prediction)?['prediction: invalid prompt, options, answer index, or feedback']:[]),...(!validQuestion(x.followup)?['followup: invalid prompt, options, answer index, or feedback']:[])];
}

export function validateLesson(x){return lessonValidationIssues(x).length===0;}
