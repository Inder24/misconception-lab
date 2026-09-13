export const starter={id:'starter-falling-objects',source:'built-in',createdAt:null,lesson:{
 title:'Does heavier mean faster?',domain:'Physics · Everyday intuitions',claim:'A heavier object always hits the ground first.',verdict:'partly_true',
 explanation:'In a vacuum, objects released from the same height accelerate equally, regardless of mass. With air resistance, mass can affect the fall time. Here we model equal-size spheres with the same linear drag coefficient, so the lighter sphere slows more.',
 assumptions:['Released from rest at 5 metres, with Earth gravity of 9.81 m/s².','Equal-size spheres; linear air drag of 0.3 kg/s when enabled. This is an idealized comparison.'],
 controls:[{id:'mass_a',label:'Sphere A',min:100,max:1000,step:100,initial:100,unit:'g'},{id:'mass_b',label:'Sphere B',min:100,max:1000,step:100,initial:1000,unit:'g'},{id:'air',label:'Air resistance (0 = off, 1 = on)',min:0,max:1,step:1,initial:0,unit:''}],
 prediction:{prompt:'In a vacuum, which sphere reaches the ground first when both start at the same height?',options:['The lighter sphere','The heavier sphere','They land together'],correctIndex:2,feedback:['Mass does not change gravitational acceleration in a vacuum. Both spheres land together.','Gravity pulls harder on the heavier sphere, but its greater inertia balances that force. Both land together.','Yes. Both have the same acceleration and land together. Try enabling air resistance to see when the answer can change.']},
 followup:{prompt:'On the Moon, without air resistance, how would the landing order change?',options:['The heavier sphere would win','They would still land together'],correctIndex:1,feedback:['Lower gravity changes the fall time equally for both spheres, so it stays a tie.','Exactly. Both take longer to fall, but they still land together.']},
 code:`const w=viewport.width,h=viewport.height,drag=params.air?0.3:0;
function distance(t,m){return drag===0?4.905*t*t:9.81*m/drag*t-9.81*m*m/(drag*drag)*(1-Math.exp(-drag*t/m));}
function landing(m){let lo=0,hi=20;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(distance(mid,m)<5)lo=mid;else hi=mid;}return (lo+hi)/2;}
const a=params.mass_a/1000,b=params.mass_b/1000,ta=landing(a),tb=landing(b),t=viewport.progress*Math.max(ta,tb);
const marks=[],ink='#23314d',muted='#64748b',blue='#4268d8',gold='#b88317';
const text=(x,y,value,size=14,color=ink,align='left')=>marks.push({type:'text',x,y,text:value,size,color,align});
const rect=(x,y,ww,hh,color)=>marks.push({type:'rect',x,y,w:ww,h:hh,color});
const line=(x,y,x2,y2,color,width=1)=>marks.push({type:'line',x,y,x2,y2,color,width});
const circle=(x,y,r,color)=>marks.push({type:'circle',x,y,r,color});
const left=26,right=w-16,lane=(right-left)/2,top=118,floor=h-68,travel=floor-top-20;
rect(0,0,w,h,'#fbfcff');
text(18,25,drag?'AIR RESISTANCE ON':'VACUUM · NO AIR',12,muted);
text(18,48,'Same height. Two masses.',w<350?17:21,ink);
text(w-16,h-12,'Elapsed '+t.toFixed(2)+' s',12,muted,'right');
rect(left,66,lane-5,h-106,'#edf2ff');rect(left+lane+5,66,lane-5,h-106,'#fff6db');
for(let i=0;i<=5;i++){const y=top+i/5*travel;line(left+8,y,right-8,y,'#dce3ee');if(w>=350)text(5,y+4,String(5-i),12,muted);}
[[a,ta,'A',left+lane*.5,blue,params.mass_a],[b,tb,'B',left+lane*1.5,gold,params.mass_b]].forEach(([m,hit,label,x,color,mass])=>{
 text(x,84,label+' · '+mass+' g',w<350?12:15,color,'center');
 const y=top+Math.min(5,distance(Math.min(t,hit),m))/5*travel;
 for(let j=1;j<=4;j++){const past=Math.max(0,t-j*.08),py=top+Math.min(5,distance(Math.min(past,hit),m))/5*travel;if(py<y-22)circle(x,py,2.5,color+'55');}
 rect(x-24,floor+2,48,4,color+'33');
 circle(x+1,y+3,20,'#1e32541a');circle(x,y,20,color);circle(x-6,y-7,7,'#ffffff30');
 text(x,y+6,label,18,'#ffffff','center');line(x-lane*.35,floor,x+lane*.35,floor,color,2);
 text(x,h-41,(t>=hit?'Landed · ':'Landing · ')+hit.toFixed(2)+' s',12,color,'center');
});
text(18,h-12,'5 m drop',12,muted);
return {marks,metrics:[{label:'Sphere A',value:ta.toFixed(2)+' s'},{label:'Sphere B',value:tb.toFixed(2)+' s'}],summary:Math.abs(ta-tb)<0.001?'Both spheres land together.':(ta<tb?'Sphere A':'Sphere B')+' lands first in this drag model.'};
`
}};
