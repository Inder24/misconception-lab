// Each percentage uses the amount immediately before it, not the original price.
export function percentageState(params){
 const initial=params.initial_amount,discountAmount=initial*params.discount/100;
 const afterDiscount=initial-discountAmount,increaseAmount=afterDiscount*params.increase/100;
 return {initial,afterDiscount,final:afterDiscount+increaseAmount,discountAmount,increaseAmount,recoveryPercent:discountAmount===0?0:afterDiscount===0?null:discountAmount/afterDiscount*100};
}

export function percentageExperiment(params,viewport){
 const state=percentageState(params),w=viewport.width,h=viewport.height,compact=h<400,narrow=w<420,progress=viewport.progress;
 const money=value=>'$'+value.toFixed(2),signed=value=>(value<0?'−':value>0?'+':'')+money(Math.abs(value));
 const marks=[],ink='#eff6ff',muted='#aec0d6',blue='#75acff',gold='#f1c460',mint='#76d7ba';
 const text=(x,y,value,size=14,color=ink,align='left')=>marks.push({type:'text',x,y,text:value,size,color,align});
 const rect=(x,y,width,height,color)=>marks.push({type:'rect',x,y,w:width,h:height,color});
 const line=(x,y,x2,y2,color,width=1)=>marks.push({type:'line',x,y,x2,y2,color,width});
 const activeStep=progress===0?0:progress<=.5?1:2;
 rect(0,0,w,h,'#111e32');
 text(16,23,'EVERYDAY MATH',12,muted);
 text(16,49,'Follow the money.',narrow?21:25);
 if(w>=520){
  text(w-18,23,['01 · ORIGINAL PRICE','02 · TAKE THE DISCOUNT','03 · INCREASE THE SALE PRICE'][activeStep],12,[blue,gold,mint][activeStep],'right');
  line(w-233,46,w-225,46,ink,2);line(w-220,46,w-212,46,ink,2);
  text(w-203,50,'Original price '+money(state.initial),12,muted);
 }
 const rowX=14,rowWidth=w-28,barX=28,barWidth=w-56,step=(h-100)/3;
 const scale=Math.max(state.initial,state.afterDiscount,state.final,1);
 const discountProgress=Math.max(0,Math.min(1,progress*2)),increaseProgress=Math.max(0,Math.min(1,progress*2-1));
 const amounts=[state.initial,state.initial-state.discountAmount*discountProgress,state.afterDiscount+state.increaseAmount*increaseProgress],colors=[blue,gold,mint];
 const labels=['01 · START','02 · '+params.discount+'% OFF','03 · '+params.increase+'% UP'];
 const bases=['Original price','Base: original price','Base: sale price'];
 const equations=[narrow?'Same dollar scale in every row.':'The dashed marker keeps the original price in view.',params.discount+'% of '+money(state.initial)+' = '+money(state.discountAmount),params.increase+'% of '+money(state.afterDiscount)+' = '+money(state.increaseAmount)];
 for(let index=0;index<3;index++){
  const y=74+index*step,visible=index===0||index===1&&progress>0||index===2&&progress>.5;
  const complete=index===0||index===1&&discountProgress===1||index===2&&increaseProgress===1;
  const barY=y+(compact?43:57),barHeight=compact?10:18;
  rect(rowX,y,rowWidth,step-9,index===activeStep?'#243b57':'#192c45');
  if(index===activeStep)rect(rowX,y,3,step-9,colors[index]);
  text(barX,y+(compact?17:21),labels[index],12,visible?colors[index]:muted);
  text(barX,y+(compact?34:42),bases[index],12,muted);
  rect(barX,barY,barWidth,barHeight,'#30435e');
  if(visible){
   text(w-28,y+(compact||narrow?23:34),money(amounts[index]),compact||narrow?22:30,colors[index],'right');
   const balanceWidth=barWidth*amounts[index]/scale;
   if(index===2){
    // The sale-price base remains amber; only the amount added is mint.
    const baseWidth=barWidth*state.afterDiscount/scale,addedWidth=balanceWidth-baseWidth;
    rect(barX,barY,baseWidth,barHeight,gold);
    rect(barX+baseWidth,barY,addedWidth,barHeight,mint);
    if(addedWidth>102&&!compact)text(barX+baseWidth+addedWidth/2,barY+13,'+'+money(state.increaseAmount*increaseProgress),12,'#123a35','center');
   }else{
    rect(barX,barY,balanceWidth,barHeight,colors[index]);
    if(index===1){
     // Ghost dollars stay on the same scale, making the removed portion visible.
     const ghostX=barX+balanceWidth,ghostEnd=barX+barWidth*state.initial/scale;
     rect(ghostX,barY,ghostEnd-ghostX,barHeight,'#f1c46017');
     for(let x=ghostX;x<ghostEnd;x+=14){const length=Math.min(barHeight,ghostEnd-x);line(x,barY+barHeight,x+length,barY+barHeight-length,'#f1c46055');}
     if(ghostEnd-ghostX>110&&!compact)text((ghostX+ghostEnd)/2,barY+13,'−'+money(state.discountAmount*discountProgress),12,gold,'center');
    }
   }
   // A dashed benchmark has the same dollar coordinate in every receipt row.
   const originalX=barX+barWidth*state.initial/scale;
   for(let dy=-4;dy<barHeight+4;dy+=7)line(originalX,barY+dy,originalX,barY+Math.min(dy+4,barHeight+4),ink,2);
   text(barX,y+(compact?67:96),complete?equations[index]:index===1?'Applying the discount…':'Adding the increase…',12,muted);
  }else{
   text(w-28,y+(compact||narrow?23:34),'—',compact||narrow?22:30,muted,'right');
   text(barX,y+(compact?67:96),index===1?'Next: subtract the discount.':'Next: increase the new amount.',12,muted);
  }
 }
 text(w/2,h-12,w>=520?'Hatched = removed dollars. Mint = added dollars.':'Dashed mark = original price.',12,muted,'center');
 const net=state.final-state.initial;
 return {marks,metrics:[{label:'Start',value:money(state.initial)},{label:'After discount',value:money(state.afterDiscount)},{label:'Final amount',value:money(state.final)},{label:'Net change',value:signed(net)}],summary:'A '+params.discount+'% discount removes '+money(state.discountAmount)+' from '+money(state.initial)+'. The '+params.increase+'% increase then adds '+money(state.increaseAmount)+' to the new base of '+money(state.afterDiscount)+', giving '+money(state.final)+'. '+(Math.abs(net)<1e-9?'These changes return to the original amount.':'The final amount is '+money(Math.abs(net))+(net<0?' below':' above')+' the original amount.')};
}

export const mathStarter={
 id:'curated-everyday-percentages',source:'curated',version:1,createdAt:'2026-09-13T00:00:00.000Z',
 catalog:{topic:'Everyday percentages',grade:'Grades 6–9',description:'Follow the money to see why equal percentage changes do not usually cancel.',tags:['Everyday math','Percentages','Changing bases']},
 lesson:{
  title:'Can percentages undo each other?',domain:'Mathematics · Everyday money',claim:'50% down and 50% up bring you back to the start.',verdict:'misconception',
  explanation:'A percentage is a fraction of a particular base amount. Half off $100 removes $50, leaving $50. A 50% increase on that new $50 adds only $25, so the result is $75. To restore $50 to $100, the increase must be 100% of the new amount.',
  assumptions:['The first percentage is subtracted from the starting amount. The second percentage is added to the amount after that discount.','Amounts are in dollars, with no tax, fees or other price changes. Arithmetic is performed before rounding the display to cents.','All three bars use the same dollars-per-pixel scale within a run. The pale marker shows the original amount.','Playback reveals the arithmetic in stages. It does not represent money changing continuously over time.'],
  controls:[{id:'initial_amount',label:'Starting amount',min:1,max:1000,step:1,initial:100,unit:'$'},{id:'discount',label:'Discount',min:0,max:80,step:1,initial:50,unit:'%'},{id:'increase',label:'Increase after discount',min:0,max:400,step:1,initial:50,unit:'%'}],
  prediction:{prompt:'A $100 item is discounted 50%, then its sale price rises 50%. What is the final price?',options:['$50','$75','$100'],correctIndex:1,feedback:['The discount leaves $50, but the later increase adds another $25. The final amount is $75.','Yes. Half of the new $50 base is $25, so $50 + $25 = $75.','The percentages use different bases. You subtract half of $100, then add half of $50, ending at $75.']},
  followup:{prompt:'A $100 price falls 20% to $80. What percentage increase restores it to $100?',options:['20%','25%','50%'],correctIndex:1,feedback:['20% of the new $80 base is $16, which only restores the price to $96.','Exactly. The missing $20 is 25% of $80, so a 25% increase restores $100.','50% of $80 is $40, which would raise the price to $120. A 25% increase adds the required $20.']},
  code:percentageState.toString()+'\nreturn ('+percentageExperiment.toString()+')(params,viewport);'
 }
};
