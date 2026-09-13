import {newtonCradle} from './newton-cradle.js';
// Original, hand-authored reference models. These pure functions are tested
// directly; their source is packaged for the same isolated worker as AI lessons.
export function buoyancyExperiment(params,viewport){
 const {object_density:rho,fluid_density:fluid,volume}=params;
 const w=viewport.width,p=viewport.progress,g=9.81,V=volume/1000;
 const fraction=Math.min(1,rho/fluid),weight=rho*V*g,buoyancy=fluid*V*fraction*g;
 const floating=rho<fluid,neutral=rho===fluid,outcome=floating?'Floating':neutral?'Neutral':'Sinking';
 const marks=[],ink='#23314d',muted='#64748b',gold='#b88317',water='#dfedf9';
 const text=(x,y,value,size=14,color=ink,align='left')=>marks.push({type:'text',x,y,text:value,size,color,align});
 const rect=(x,y,width,height,color)=>marks.push({type:'rect',x,y,w:width,h:height,color});
 const line=(x,y,x2,y2,color=ink,width=2)=>marks.push({type:'line',x,y,x2,y2,color,width});
 const arrow=(x,start,end,color)=>{line(x,start,x,end,color,3);const direction=Math.sign(end-start);line(x,end,x-5,end-direction*7,color,2);line(x,end,x+5,end-direction*7,color,2);};
 text(20,29,'The float test',20);text(20,53,floating?'Floating equilibrium':neutral?'Fully submerged · neutral':'Fully submerged · sinking',14,muted);
 text(20,79,'W ↓ weight     B ↑ buoyancy',12,muted);
 const surface=146,size=38+Math.cbrt(volume)*12,cx=w*.34;
 rect(18,surface,w-36,138,water);rect(18,surface,w-36,8,'#bcd9f2');rect(18,250,w-36,34,'#cddfed');line(18,surface,w-18,surface,'#669bcc',2);
 for(let i=0;i<5;i++){const yy=surface+22+i*22;line(w-32,yy,w-22,yy,'#7da2c2',1);}
 line(18,surface,18,284,'#aac4db',2);line(w-18,surface,w-18,284,'#aac4db',2);
 for(let x=24;x<w-22;x+=24)line(x,281,x+7,281,'#aaccc8',1);
 const top=floating?surface-size*(1-fraction):surface+28+(neutral?0:p*18);
 rect(cx-size/2+4,top+4,size,size,'#23314d15');rect(cx-size/2,top,size,size,'#d6a357');rect(cx-size/2,top,6,size,'#f4ce84');rect(cx-size/2+6,top,size-6,5,'#efc879');
 const wetTop=Math.max(surface,top),wetHeight=Math.max(0,top+size-wetTop);rect(cx-size/2,wetTop,size,wetHeight,'#bb8c48');
 line(cx-size/2,top,cx+size/2,top,gold,2);line(cx-size/2,top,cx-size/2,top+size,gold,2);line(cx+size/2,top,cx+size/2,top+size,gold,2);
 text(cx,top+size/2+5,String(rho),12,'#ffffff','center');
 const base=193,scale=48/Math.max(weight,buoyancy),reveal=.35+.65*p;
 arrow(w*.70,base,base+weight*scale*reveal,'#a06b2c');arrow(w*.85,base,base-buoyancy*scale*reveal,'#287768');
 text(w*.70,base+weight*scale*reveal+20,'W',14,'#a06b2c','center');text(w*.85,base-buoyancy*scale*reveal-10,'B',14,'#287768','center');
 text(20,308,floating?'Displaced fluid weighs as much as the object.':neutral?'Equal density: no net weight–buoyancy force.':'Weight exceeds buoyancy while submerged.',12,muted);
 text(20,329,'Force reveal · no drag or bottom contact',12,muted);
 return {marks,metrics:[{label:'Weight',value:weight.toFixed(2)+' N'},{label:'Buoyancy',value:buoyancy.toFixed(2)+' N'},{label:'Submerged',value:(fraction*100).toFixed(1)+'%'},{label:'Outcome',value:outcome}],summary:floating?`The object floats with ${(fraction*100).toFixed(1)}% of its volume submerged. At equilibrium, buoyancy and weight both equal ${weight.toFixed(2)} N. Changing volume scales both forces without changing this fraction.`:neutral?`The fully submerged object has neutral buoyancy: weight and buoyancy both equal ${weight.toFixed(2)} N. In this ideal model it can remain at rest at any depth, away from boundaries.`:`When fully submerged, buoyancy is ${buoyancy.toFixed(2)} N and weight is ${weight.toFixed(2)} N. The object tends to sink. This shows the force comparison without drag or bottom contact; the reveal is not a motion simulation.`};
}

export function lensExperiment(params,viewport){
 const {object_distance:u,focal_length:f,object_height:ho}=params;
 const w=viewport.width,p=viewport.progress,atFocus=u===f,di=atFocus?null:f*u/(u-f),m=atFocus?null:-di/u,hi=atFocus?null:m*ho;
 const virtual=!atFocus&&di<0,ink='#23314d',muted='#64748b',green='#4268d8',gold='#b88317';
 const marks=[];
 const text=(x,y,value,size=14,color=ink,align='left')=>marks.push({type:'text',x,y,text:value,size,color,align});
 const line=(x,y,x2,y2,color=ink,width=2)=>marks.push({type:'line',x,y,x2,y2,color,width});
 const signed=value=>(value<0?'−':'+')+Math.abs(value).toFixed(2);
 text(18,29,'Through a converging lens',w<400?18:20);text(18,53,atFocus?'At the focal plane · no finite image':virtual?'Virtual image · upright':'Real image · inverted',14,muted);
 text(18,78,'Blue: parallel ray   Gold: central ray',12,muted);
 marks.push({type:'rect',x:14,y:94,w:w-28,h:170,color:'#f0f4fb'});
 const left=Math.max(u,f,virtual?Math.min(-di,u*3):0)*1.18,right=Math.max(f,!atFocus&&!virtual?Math.min(di,u*3):0)*1.18;
 const sx=(w-44)/(left+right),sy=51/Math.max(ho,hi===null?ho:Math.min(Math.abs(hi),ho*3)),axis=177,L=22+left*sx;
 const X=x=>L+x*sx,Y=y=>axis-y*sy,box={left:18,right:w-18,top:98,bottom:259};
 // Clip line segments to the optical window before they enter the mark protocol.
 function segment(x1,y1,x2,y2,color,width=2,dashed=false){
  let ax=X(x1),ay=Y(y1),bx=X(x2),by=Y(y2),dx=bx-ax,dy=by-ay,t0=0,t1=1;
  for(const [a,b]of [[-dx,ax-box.left],[dx,box.right-ax],[-dy,ay-box.top],[dy,box.bottom-ay]]){
   if(a===0){if(b<0)return;continue;}const t=b/a;if(a<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);if(t0>t1)return;
  }
  bx=ax+dx*t1;by=ay+dy*t1;ax+=dx*t0;ay+=dy*t0;
  if(!dashed){line(ax,ay,bx,by,color,width);return;}
  const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/10));for(let i=0;i<n;i++){const a=i/n,b=Math.min(1,a+0.5/n);line(ax+(bx-ax)*a,ay+(by-ay)*a,ax+(bx-ax)*b,ay+(by-ay)*b,color,1);}
 }
 line(18,axis,w-18,axis,'#a8bbb0',1);
 const outline=[];for(let i=0;i<=24;i++){const t=i/24;outline.push({x:L+8*Math.sin(Math.PI*t),y:axis-66+132*t});}
 marks.push({type:'polyline',points:outline,color:'#9bbdad',width:2},{type:'polyline',points:outline.map(point=>({x:2*L-point.x,y:point.y})),color:'#9bbdad',width:2});
 line(L,axis-62,L,axis+62,'#bad5ed',8);line(L-2,axis-58,L-2,axis+58,'#e6f4ff',2);
 for(const [x,label]of [[-f,'F'],[f,"F′"]]){marks.push({type:'circle',x:X(x),y:axis,r:3,color:ink});text(X(x),axis+19,label,12,ink,'center');}
 const extent=right*(.15+.85*p);
 segment(-u,ho,0,ho,green,2);segment(0,ho,extent,ho*(1-extent/f),green,2);
 segment(-u,ho,0,0,gold,2);segment(0,0,extent,-ho*extent/u,gold,2);
 if(virtual){const back=Math.max(di,-left);segment(0,ho,back,ho*(1-back/f),'#86aa98',1,true);segment(0,0,back,-ho*back/u,'#bbaa8a',1,true);}
 function objectArrow(x,height,color){const px=X(x),py=Y(height);if(px<box.left||px>box.right||py<box.top||py>box.bottom)return false;line(px,axis,px,py,color,3);const direction=Math.sign(axis-py);line(px,py,px-5,py+direction*7,color,2);line(px,py,px+5,py+direction*7,color,2);return true;}
 objectArrow(-u,ho,ink);const imageShown=!atFocus&&objectArrow(di,hi,'#9769a1');
 text(18,282,'Object ↑',12,ink);text(w-18,282,atFocus?'Outgoing rays are parallel':imageShown?(virtual?'Image ↑ · dashed extensions':'Image ↓ · rays converge'):'Image extends beyond this view',12,'#805b87','right');
 text(18,308,atFocus?'Move the object off F to form a finite image.':virtual?'Light diverges; extensions meet on the left.':'Light meets on the opposite side of the lens.',12,muted);
 text(18,329,'Schematic · ideal thin lens · distances in cm',12,muted);
 return {marks,metrics:[{label:'Image distance',value:atFocus?'At infinity':signed(di)+' cm'},{label:'Magnification',value:atFocus?'No finite image':signed(m)+'×'},{label:'Image height',value:atFocus?'No finite image':signed(hi)+' cm'},{label:'Image',value:atFocus?'Parallel outgoing rays':virtual?'Virtual · upright':'Real · inverted'}],summary:atFocus?'The object lies in the focal plane. Rays from its tip emerge parallel, so there is no finite image distance or finite linear magnification in this ideal thin-lens model.':`The image distance is ${signed(di)} cm and signed magnification is ${signed(m)}. ${virtual?'The virtual, upright image lies on the object side; dashed lines show backward extensions, not traveling light.':'The real, inverted image lies on the opposite side and can be formed on a screen.'} ${imageShown?'':'The image extends beyond the displayed window; the metrics still report its full calculated size and position.'}`.trim()};
}

const createdAt='2026-09-13T00:00:00.000Z';
export const experimentStarters=[
 {id:'curated-buoyancy',source:'curated',version:1,createdAt,catalog:{topic:'Buoyancy and density',grade:'Grades 6–9',description:'Compare weight, displaced fluid, and floating equilibrium.',tags:['physics','density','fluids','forces']},lesson:{
  title:'What decides whether it floats?',domain:'Physics · Buoyancy',claim:'Making a solid object larger always makes it sink.',verdict:'misconception',
  explanation:'For a rigid object, density relative to the fluid determines whether it can float. A floating object settles until the weight of displaced fluid equals its own weight. Increasing volume at the same density increases both weight and available buoyancy proportionally. An object denser than the fluid remains heavier than the displaced fluid even when fully submerged.',
  assumptions:['A rigid, uniform-density object in a large, uniform-density fluid under Earth gravity, 9.81 m/s². Volume is in litres; 1 L = 0.001 m³.','Floating cases show equilibrium: submerged volume fraction = object density ÷ fluid density. Denser and equal-density objects are shown fully submerged.','Surface tension, air buoyancy, fluid drag, and bottom or wall contact are excluded. Equal density gives neutral buoyancy away from boundaries.','Playback reveals force arrows and a schematic submerged position; it does not calculate settling speed or a trajectory.'],
  controls:[{id:'object_density',label:'Object density',min:200,max:2400,step:100,initial:600,unit:'kg/m³'},{id:'fluid_density',label:'Fluid density',min:600,max:1400,step:100,initial:1000,unit:'kg/m³'},{id:'volume',label:'Object volume',min:.5,max:4,step:.5,initial:1,unit:'L'}],
  prediction:{prompt:'A 1 L object of density 600 kg/m³ is placed in fluid of density 1000 kg/m³. At equilibrium, what happens?',options:['It floats with 60% submerged','It floats with 40% submerged','It sinks because it has weight'],correctIndex:0,feedback:['Yes. At 60% submersion, displaced fluid and object have equal weight.','40% is the fraction above the surface. The submerged fraction is 600 ÷ 1000 = 60%.','Weight acts downward, but displaced fluid provides buoyancy. Here the forces balance before full submersion.']},
  followup:{prompt:'Keep both densities unchanged and double the object volume. What happens to the fraction submerged?',options:['It doubles','It stays at 60%','The object must sink'],correctIndex:1,feedback:['Both weight and buoyant force scale with volume, so their balance requires the same fraction.','Exactly. Density ratio stays 600 ÷ 1000, even though both forces double.','Volume alone does not change the density ratio. A larger object still floats under these assumptions.']},code:`return (${buoyancyExperiment.toString()})(params, viewport);`
 }},
 {id:'curated-thin-lens',source:'curated',version:1,createdAt,catalog:{topic:'Converging lenses',grade:'Grades 9–12',description:'Trace rays and cross the boundary between real and virtual images.',tags:['physics','optics','lenses','ray diagrams']},lesson:{
  title:'Does a lens always magnify?',domain:'Physics · Optics',claim:'A converging lens always produces a larger, upright image.',verdict:'misconception',
  explanation:'A converging lens can form either a real, inverted image or a virtual, upright image. With object distance u and positive focal length f, the image distance is v = fu ÷ (u − f), and signed magnification is −v ÷ u. A negative image distance places a virtual image on the object side. At u = f, the outgoing rays are parallel and there is no finite image.',
  assumptions:['An ideal thin converging lens in air, using the paraxial ray approximation. Distances and heights are in centimetres.','A real object is on the left. Positive image distance means the opposite side; negative image distance means the object side. Negative magnification means inverted.','Lens thickness, aberrations, diffraction, and aperture clipping are excluded. The drawing is a schematic; its horizontal and vertical scales may differ.','Blue rays enter parallel to the axis and pass through the far focal point. Gold rays pass through the optical centre. Dashed lines are backward extensions.','At the focal-plane limit the model reports no finite image. Extreme images may lie outside the drawing window; the signed metrics remain complete.'],
  controls:[{id:'object_distance',label:'Object distance',min:5,max:60,step:1,initial:30,unit:'cm'},{id:'focal_length',label:'Focal length',min:5,max:20,step:1,initial:10,unit:'cm'},{id:'object_height',label:'Object height',min:1,max:6,step:.5,initial:3,unit:'cm'}],
  prediction:{prompt:'A 3 cm object is 30 cm from a converging lens of focal length 10 cm. What image forms?',options:['Larger and upright','Smaller and inverted','No image can form'],correctIndex:1,feedback:['This object is beyond twice the focal length. Its image is real, smaller, and inverted.','Yes. The image forms 15 cm away with magnification −0.5 and height −1.5 cm.','A finite real image forms because the object is beyond the focal plane.']},
  followup:{prompt:'Move the object to 5 cm while the focal length stays 10 cm. What changes?',options:['The image stays real and inverted','The image becomes virtual, upright, and larger'],correctIndex:1,feedback:['Inside the focal length, emerging rays diverge. Their backward extensions meet on the object side.','Yes. The virtual image is 10 cm on the object side, with magnification +2.']},code:`return (${lensExperiment.toString()})(params, viewport);`
 }}
,newtonCradle
];
