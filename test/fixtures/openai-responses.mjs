import {starter} from '../../public/starter.js';
const output=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
export function createFixtureFetcher(){
 let generations=0;
 return async(url,init)=>{
  if(url!=='https://api.openai.com/v1/responses')return Response.json({error:'Live sessions are deliberately unavailable in the browser fixture.'},{status:503});
  const body=JSON.parse(init.body),name=body.text.format.name;
  if(name==='teaching_plan'){
   const {brief}=JSON.parse(body.input);
   return output({brief,cards:[{id:'falling-objects',claim:'A heavier object always hits the ground first.',rationale:'A learner may connect a stronger pull with greater acceleration.',quickCheck:brief.includeQuickChecks?'Which object reaches the ground first in a vacuum?':'',experiment:'Drop two spheres from the same height and compare their landing times with and without air resistance.',variable:'Mass and air resistance'}]});
  }
  if(name==='teaching_brief_import'){
   await new Promise(resolve=>setTimeout(resolve,1500));
   return output({brief:{topic:'Photosynthesis in plants',grade:'Grade 5',subject:'Science',learningGoal:'Explain the inputs and outputs of photosynthesis',observedBeliefs:'Plants only need sunlight to grow.\nPlants do not use oxygen.\nPlants get their food from soil.',includeQuickChecks:true},regions:[{field:'topic',label:'Photosynthesis topic',x:.04,y:.15,width:.88,height:.12},{field:'observedBeliefs',label:'Observed student beliefs',x:.04,y:.36,width:.88,height:.36}],uncertainty:'Controlled screenshot-response fixture. Correct these fields before planning; this is not live image interpretation.'});
  }
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
