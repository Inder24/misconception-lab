// A shared, deterministic model for the sandbox drawing and its playback UI.
// Equal-radius spheres use the same idealized linear drag coefficient.
export function fallingState(params, progress = 1) {
 const gravity=9.81, height=Number.isFinite(params.height)?params.height:5, drag=params.air?0.3:0;
 const distance=(time,mass)=>drag===0?gravity*time*time/2:gravity*mass/drag*(time+mass/drag*Math.expm1(-drag*time/mass));
 const arrival=mass=>{
  if(drag===0)return Math.sqrt(2*height/gravity);
  let low=0,high=Math.sqrt(2*height/gravity);
  while(distance(high,mass)<height)high*=2;
  for(let i=0;i<60;i++){const mid=(low+high)/2;if(distance(mid,mass)<height)low=mid;else high=mid;}
  return (low+high)/2;
 };
 const massA=params.mass_a/1000,massB=params.mass_b/1000,arrivalA=arrival(massA),arrivalB=arrival(massB);
 const duration=Math.max(arrivalA,arrivalB),time=Math.max(0,Math.min(1,progress))*duration;
 const ball=(mass,landingTime)=>{
  const landed=time>=landingTime-1e-10,fallTime=Math.min(time,landingTime);
  return {mass,landingTime,landed,distance:Math.min(height,Math.max(0,distance(fallTime,mass))),speed:landed?0:drag===0?gravity*time:-gravity*mass/drag*Math.expm1(-drag*time/mass)};
 };
 return {height,drag,time,duration,gap:Math.abs(arrivalA-arrivalB),a:ball(massA,arrivalA),b:ball(massB,arrivalB)};
}

export function fallingExperiment(params,viewport) {
 const state=fallingState(params,viewport.progress),w=viewport.width,h=viewport.height;
 const marks=[],ink='#edf5ff',muted='#aec0d6',grid='#2b3a52',blue='#66a7ff',gold='#f1c460';
 const text=(x,y,value,size=14,color=ink,align='left')=>marks.push({type:'text',x,y,text:value,size,color,align});
 const rect=(x,y,width,height,color)=>marks.push({type:'rect',x,y,w:width,h:height,color});
 const line=(x,y,x2,y2,color=grid,width=1)=>marks.push({type:'line',x,y,x2,y2,color,width});
 const circle=(x,y,r,color)=>marks.push({type:'circle',x,y,r,color});
 const ceiling=112,ground=h-94,floor=h-76,travel=ground-ceiling,lane=(w-88)/2,left=76;
 const yAt=distance=>ground-(state.height-distance)/10*travel,release=yAt(0),radius=18;
 rect(0,0,w,h,'#111e32');
 text(16,23,'EARTH GRAVITY',12,muted);
 text(w-16,23,state.drag?'LINEAR DRAG':'NO AIR',12,state.drag?gold:blue,'right');
 text(16,48,'Elapsed '+state.time.toFixed(2)+' s',w<350?18:22);
 text(w-16,47,state.height+' m release',12,muted,'right');
 rect(left,65,lane-4,floor-54,'#172c47');
 rect(left+lane+4,65,lane-4,floor-54,'#2c2e35');
 for(let metres=0;metres<=10;metres+=2){
  const y=ground-metres/10*travel;
  line(52,y,57,y,muted);text(61,y+4,String(metres),12,muted);
  line(left+6,y,w-18,y,grid);
 }
 line(55,ceiling,55,ground,muted);
 text(56,98,'m',12,muted,'center');
 // The release guide stays at its physical elevation on the fixed 10 m ruler.
 for(let x=76;x<w-16;x+=14)line(x,release,Math.min(x+7,w-16),release,'#a7bacf',2);
 for(const [ball,label,x,color,mass]of [[state.a,'A',left+lane/2,blue,params.mass_a],[state.b,'B',left+lane*1.5,gold,params.mass_b]]){
  text(x,84,label+' · '+mass+' g',w<350?12:15,color,'center');
  const y=yAt(ball.distance);
  // Equal time samples reveal acceleration; stationary balls do not leave trails.
  for(let j=1;j<=5;j++){
   const past=Math.max(0,state.time-j*.09),sample=fallingState(params,past/state.duration)[label==='A'?'a':'b'];
   const py=yAt(sample.distance);
   if(py<y-radius-5)circle(x,py,Math.max(2,5-j*.6),color+'55');
  }
  rect(x-lane*.36,floor-2,lane*.72,5,color+'77');
  if(ball.landed){
   line(x-25,floor+7,x+25,floor+7,color,2);
   text(x,floor+29,'At rest · 0 m/s',12,color,'center');
  }else{
   text(x,floor+29,ball.speed.toFixed(1)+' m/s ↓',12,color,'center');
   if(w>=350&&ball.speed>.1){
    const arrowX=x+29,arrowEnd=Math.min(floor-7,y+Math.min(37,ball.speed*2.5));
    if(arrowEnd>y+7){line(arrowX,y,arrowX,arrowEnd,color,2);line(arrowX,arrowEnd,arrowX-4,arrowEnd-6,color,2);line(arrowX,arrowEnd,arrowX+4,arrowEnd-6,color,2);}
   }
  }
  circle(x,y+2,radius+2,'#00000022');circle(x,y,radius,color);
  circle(x-5,y-6,6,'#ffffff35');text(x,y+6,label,18,'#12233b','center');
  text(x,floor+49,ball.landed?'Landed '+ball.landingTime.toFixed(2)+' s':state.time===0?'Ready to drop':'Falling…',12,muted,'center');
 }
 const together=state.gap<.001;
 text(w/2,h-9,state.a.landed&&state.b.landed?(together?'Together · gap 0.00 s':'Arrival gap · '+state.gap.toFixed(2)+' s'):'Equal size. Shared release.',12,together?muted:gold,'center');
 return {marks,metrics:[{label:'Sphere A',value:state.a.landingTime.toFixed(2)+' s'},{label:'Sphere B',value:state.b.landingTime.toFixed(2)+' s'},{label:'Arrival gap',value:state.gap.toFixed(2)+' s'}],summary:together?'Both spheres land together.':(state.a.landingTime<state.b.landingTime?'Sphere A':'Sphere B')+' lands first in this idealized linear drag model. The arrival gap is '+state.gap.toFixed(2)+' seconds.'};
}
