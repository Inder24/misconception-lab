import {starter} from '../../public/starter.js';
const output=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
export function createFixtureFetcher(){
 let generations=0;
 return async(url,init)=>{
  if(url!=='https://api.openai.com/v1/responses')return Response.json({error:'Live sessions are deliberately unavailable in the browser fixture.'},{status:503});
  const body=JSON.parse(init.body),name=body.text.format.name;
  if(name==='scientific_review')return output({passed:true,summary:'Controlled test review: calculations and question agree with the supplied fixture.',issues:[]});
  if(name==='image_hypothesis')return output({claim:'A heavier object always hits the ground first.',observations:['Two objects are drawn at the same starting height.','An arrow suggests the heavier object lands first.'],regions:[{x:.15,y:.1,width:.3,height:.45,label:'Object and direction of motion'}],uncertainty:'This is a controlled image-response fixture. Check the interpretation before generating.'});
  if(name==='adaptive_tutor'){
   const data=JSON.parse(body.input);
   return output({message:`You said: “${data.reason}” The force is greater, but the inertia is greater too. Compare that reasoning with the measured fall times.`,reasoningFocus:'Distinguishing force from acceleration.',question:{prompt:'Two equal-size spheres with different masses are released from rest on the Moon, where air resistance is negligible. Which reaches the ground first?',options:['The heavier sphere','They arrive together','The lighter sphere'],correctIndex:1,feedback:['Compare gravitational force with inertia: both scale with mass.','Correct. The same gravitational acceleration applies to both.','Lower gravity affects both spheres equally.']}});
  }
  const lesson=structuredClone(starter.lesson);
  if(body.instructions.includes('full revised lesson')){
   lesson.title='What if gravity changed?';lesson.controls.push({id:'gravity',label:'Gravity',min:1,max:20,step:1,initial:10,unit:'m/s²'});
   lesson.code=lesson.code.replaceAll('4.905','(params.gravity/2)').replaceAll('9.81','params.gravity');
   lesson.assumptions=['Released from rest at 5 metres, with adjustable gravity.','Equal-size spheres; linear drag when enabled.'];
   lesson.prediction.prompt='With gravity fixed at 10 m/s² and no air resistance, which sphere lands first?';
   return output(lesson);
  }
  if(!body.instructions.includes('Repair the supplied lesson')){generations++;if(generations===1)lesson.code='throw new Error("Controlled runtime failure for repair verification");';}
  return output(lesson);
 };
}
