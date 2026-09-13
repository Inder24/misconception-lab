import {starter} from './starter.js';
import {fallingState} from './falling-model.js';
import {mathStarter} from './math-starter.js';

// Demonstration actions are authored and bounded; Astra supplies explanations only.
export function demoWalkthrough(envelope){
 const matches=entry=>entry.id===envelope.id&&entry.lesson.code===envelope.lesson.code&&entry.source===envelope.source;
 if(matches(starter)){
  const vacuum={mass_a:100,mass_b:1000,air:0,height:5},air={...vacuum,air:1},arrival=fallingState(air);
  return {intro:'We will keep the drop fair, add air, then test equal masses. The guide uses a 5 m release.',steps:[
   {id:'release',title:'Set up a fair drop',focus:'Equal-sized balls start at rest from the same 5 m height. A has 100 g and B has 1000 g. No motion yet.',params:vacuum,progress:0,narration:'Both balls start from rest at 5 metres. Ball B has ten times the mass, but the balls are the same size. Watch what happens without air.'},
   {id:'vacuum',title:'Different mass. Same arrival.',focus:'Let both balls fall in vacuum. They land together at about 1.01 s; mass does not change gravitational acceleration.',params:vacuum,progress:1,narration:'Both land at 1.01 seconds. Gravity pulls harder on the heavier ball, but it also takes more force to accelerate that mass. The acceleration is the same.'},
   {id:'air',title:'Now let air push back',focus:'Pause exactly when B first contacts the ground. A is still falling. The displayed final landing times summarize the full run, not just this paused frame.',params:air,progress:arrival.b.landingTime/arrival.duration,narration:'Now the heavier ball lands while the lighter one is still falling. With the same drag coefficient, air has a greater slowing effect on the lighter ball. We have paused at B’s landing.'},
   {id:'equal',title:'Change the mass, test the explanation',focus:'Set both equal-sized balls to 100 g with air still on. They now land together; air alone does not imply different fall times.',params:{...air,mass_b:100},progress:1,narration:'With equal masses and equal sizes, both balls respond to drag in the same way and land together. The difference came from how drag affected their motion.'}
  ]};
 }
 if(matches(mathStarter)){
  const amounts={initial_amount:100,discount:50,increase:50};
  return {intro:'Follow one price through two percentage changes. Each step highlights the amount used as the percentage base.',steps:[
   {id:'start',title:'Start with $100',focus:'At progress 0 only the original $100 price is revealed. Establish this as the first percentage base.',params:amounts,progress:0,narration:'Start with $100. A percentage is always a fraction of some amount. For the first change, that amount is the original $100.'},
   {id:'discount',title:'50% off the original amount',focus:'At progress .5 the discount step is revealed: 50% of $100 is $50, so $50 remains. The final-price metric is a full-run measurement, not this intermediate balance.',params:amounts,progress:.5,narration:'Half of $100 is $50. Subtract that discount and the price becomes $50. This smaller amount is now the base for the next change.'},
   {id:'increase',title:'50% up uses a different base',focus:'Reveal the last step. 50% of the current $50 is $25. Adding $25 gives $75, not the original $100.',params:amounts,progress:1,from:.5,narration:'The increase is half of $50, which is only $25. Add it back and you get $75. The two 50% changes do not cancel because they use different starting amounts.'},
   {id:'recover',title:'What would bring it back?',focus:'Keep the 50% discount, change the increase to 100%. A 100% increase on $50 adds $50 and recovers the original $100.',params:{...amounts,increase:100},progress:1,from:.5,narration:'To go from $50 back to $100, you need to add the full $50. That is a 100% increase on the discounted price. Try another discount after the walkthrough.'}
  ]};
 }
 return null;
}
