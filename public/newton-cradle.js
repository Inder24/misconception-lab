// Trusted reference model; serialized into the same isolated worker as generated labs.
export function cradleExperiment(params,viewport){
 const {height,mass=100,swings}=params,balls=1,w=viewport.width,p=Math.max(0,Math.min(1,viewport.progress));
 const h=height/100,L=1,g=9.81,amplitude=Math.acos(1-h/L),phase=p*swings*2*Math.PI;
 // Instantaneous equal-mass transfer, with approximate harmonic pendulum timing.
 const excursion=Math.cos(phase),angle=amplitude*Math.abs(excursion),left=excursion>=0;
 const potential=(1-Math.cos(angle))/(1-Math.cos(amplitude)),kinetic=1-potential;
 const marks=[],white='#edf5ff',muted='#9badc9',blue='#80baff',gold='#ffd479';
 const rect=(x,y,width,height,color)=>marks.push({type:'rect',x,y,w:width,h:height,color});
 const line=(x,y,x2,y2,color,width=2)=>marks.push({type:'line',x,y,x2,y2,color,width});
 const circle=(x,y,r,color)=>marks.push({type:'circle',x,y,r,color});
 const text=(x,y,value,size=14,color=white,align='left')=>marks.push({type:'text',x,y,text:value,size,color,align});
 rect(0,0,w,340,'#101d36');rect(0,264,w,76,'#162642');
 text(20,28,"NEWTON’S CRADLE",16);text(w-20,28,'IDEAL MODEL',12,muted,'right');
 text(20,51,'One ball released · '+mass+' g each',14,muted);
 const scale=Math.min(1,(w-36)/560),r=23*scale,len=158*scale,pivotY=83,cy=pivotY+len,cx=w/2;
 const anchor=i=>cx+(i-2)*r*2;
 const edge=anchor(0)-len*Math.sin(amplitude)-r-12*scale;
 // Backlit gantry, feet and a subtly reflective base.
 rect(edge-8,pivotY-13,w-2*edge+16,8,'#344b6c');
 line(edge,pivotY-7,edge,cy+34,'#486181',6);line(w-edge,pivotY-7,w-edge,cy+34,'#486181',6);
 line(edge+2,pivotY,edge+2,cy+31,'#9bb0ca',1);line(w-edge-2,pivotY,w-edge-2,cy+31,'#9bb0ca',1);
 rect(edge-14,cy+31,w-2*edge+28,8,'#304762');line(edge-14,cy+31,w-edge+14,cy+31,'#8198b8',2);
 // Dashed reference arcs show the maximum swing envelope on each side.
 for(const side of [-1,1]){const ax=anchor(side<0?0:4);for(let j=0;j<18;j+=2){const a=amplitude*j/18,b=amplitude*(j+1)/18;line(ax+side*len*Math.sin(a),pivotY+len*Math.cos(a),ax+side*len*Math.sin(b),pivotY+len*Math.cos(b),'#516788',1);}}
 for(let i=0;i<5;i++){
  const active=left?i<balls:i>=5-balls,a=active?(left?-angle:angle):0,ax=anchor(i),x=ax+len*Math.sin(a),y=pivotY+len*Math.cos(a);
  circle(x+3,cy+r+13,Math.max(2,r*.47),'#0b1428');
  line(ax-5*scale,pivotY,x-3*scale,y,'#637d9f',1);line(ax+5*scale,pivotY,x+3*scale,y,'#c4d5ec',1);circle(ax,pivotY,3*scale,'#bacce4');
  if(active){
   // Moving ghost positions make direction legible even at slow playback speeds.
   for(let trail=4;trail>=1;trail--){
    const oldPhase=Math.max(0,phase-trail*.045),oldExcursion=Math.cos(oldPhase);
    if((oldExcursion>=0)===left){const oldAngle=amplitude*oldExcursion;
     circle(ax-len*Math.sin(oldAngle),pivotY+len*Math.cos(oldAngle),r*(.65-trail*.08),'#334762');}
   }
   circle(x,y,r+5*scale,'#253d5b');
  }
  circle(x,y,r,active?'#b28a44':'#536b8c');circle(x-2*scale,y-2*scale,r*.88,active?'#e7b95f':'#97aac3');
  circle(x-5*scale,y-5*scale,r*.65,active?'#ffdc8a':'#d3deec');circle(x-7*scale,y-8*scale,r*.28,'#ffffff');
  text(x,y+8*scale,String(i+1),12,'#20324b','center');
 }
 const liftY=cy-len*h;
 line(edge+10*scale,liftY,edge+10*scale,cy,blue,2);
 line(edge+6*scale,liftY,edge+14*scale,liftY,blue,2);line(edge+6*scale,cy,edge+14*scale,cy,blue,2);
 text(edge+6*scale,liftY-26,height+' cm',12,blue);
 if(Math.abs(excursion)<.12){line(anchor(0),cy+r+4,anchor(4),cy+r+4,gold,3);text(cx,cy+r+22,'Energy transfers →',12,gold,'center');}
 text(20,286,'HEIGHT '+(mass/1000*g*h*potential).toFixed(3)+' J',12,blue);text(w-20,286,'MOTION '+(mass/1000*g*h*kinetic).toFixed(3)+' J',12,gold,'right');
 const barWidth=w-40;rect(20,297,barWidth,8,'#304360');rect(20,297,barWidth*potential,8,blue);rect(20+barWidth*potential,297,barWidth*kinetic,8,gold);
 text(20,328,'Swing '+Math.min(swings,Math.floor(p*swings)+1)+' / '+swings,12,muted);text(w-20,328,'Approximate swing timing',12,muted,'right');
 return {marks,metrics:[{label:'Mass of each ball',value:mass+' g'},{label:'Speed at first impact',value:Math.sqrt(2*g*h).toFixed(2)+' m/s'},{label:'Energy in the swing',value:(mass/1000*g*h).toFixed(3)+' J'},{label:'Opposite peak height',value:height+' cm'}],summary:`One ball released from ${height} cm transfers its motion to one ball at the opposite end, which rises to ${height} cm. Each ball has mass ${mass} g. The swing carries ${(mass/1000*g*h).toFixed(3)} J; impact speed is ${Math.sqrt(2*g*h).toFixed(2)} m/s. Increasing all five masses equally increases energy, but not speed or peak height. Playback shows ${swings} lossless cycles.`};
}
export const newtonCradle={id:'curated-newton-cradle',source:'curated',version:2,createdAt:'2026-09-13T00:00:00.000Z',catalog:{topic:"Newton’s cradle",grade:'Grades 6–10',description:'Lift one ball. Change the height and mass. Watch energy travel through a chain of steel.',tags:['physics','momentum','energy','pendulums']},lesson:{
 title:'One ball in. What swings out?',domain:'Physics · Momentum & energy',claim:'Releasing one ball from a greater height makes more balls swing out.',verdict:'misconception',
 explanation:'In an ideal cradle of identical balls, one ball transfers its motion to one ball at the opposite end. Changing the mass of all five balls together changes energy (mgh) and momentum, but not impact speed or the outgoing height. Lifting higher adds gravitational potential energy, so the outgoing balls move faster and rise higher. It does not increase their number. At each swing’s peak, energy is stored in height; at the bottom, it is in motion. Both momentum and kinetic energy are conserved during the ideal collision.',
 assumptions:['Five identical balls on parallel, massless 1 m suspensions, under gravity of 9.81 m/s². Only the leftmost ball is released. The mass slider changes all five masses equally; unequal-mass collisions are not modeled. Ball size stays fixed, so this represents changing density.','An ideal instantaneous transfer model: the same number of balls emerges at the opposite end. Collisions are perfectly elastic; drag, sound, friction, deformation and real multi-contact dynamics are omitted.','Release height is measured vertically from the resting ball centre. Impact speed = √(2gh). The outgoing peak height equals the release height.','Swing angle is drawn using approximate harmonic timing, with maximum angle acos(1 − h/L). Playback is a schematic phase animation, not a precision clock. The energy bar uses the displayed angle and conserves total energy.','Swings shown counts complete left–right–left cycles. Real cradles gradually lose energy and may develop more complicated motion.'],
 controls:[{id:'height',label:'Release height',min:2,max:25,step:1,initial:15,unit:'cm'},{id:'mass',label:'Mass of each ball (all five)',min:50,max:500,step:10,initial:100,unit:'g'},{id:'swings',label:'Complete swings shown',min:1,max:5,step:1,initial:3,unit:'cycles'}],
 prediction:{prompt:'Release one ball from 15 cm. In this ideal cradle, what happens at the opposite end?',options:['One ball rises to 15 cm','Two balls rise because the impact is strong','All five balls swing together'],correctIndex:0,feedback:['Exactly. One ball carries the motion onward and rises to the same height.','A greater height increases speed, not the number of outgoing balls.','The ideal transfer passes motion through the middle balls to the far end.']},
 followup:{prompt:'Double the mass of every ball and release one from the same height. What changes?',options:['It moves twice as fast','It carries twice the energy, at the same speed','Two balls swing out instead of one'],correctIndex:1,feedback:['Impact speed is √(2gh): mass cancels when gravitational energy becomes motion.','Exactly. Energy mgh doubles, while the impact speed and opposite peak height stay the same.','All balls still have equal mass. One incoming ball transfers motion to one outgoing ball.']},code:`return (${cradleExperiment.toString()})(params, viewport);`
}};
