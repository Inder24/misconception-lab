/** Timeline only: render must not mutate the experiment's measured results.
 * Await reset()/destroy() before replacing a host or changing its parameters.
 * An already-running render cannot be undone, so these methods drain it first.
 */
export function createPlayback({render,onChange=()=>{},onError=()=>{},duration=3000,
 now=()=>performance.now(),schedule=callback=>setTimeout(callback,16),cancel=handle=>clearTimeout(handle)}){
 if(typeof render!=='function')throw new TypeError('Playback needs a renderer.');
 if(!Number.isFinite(duration)||duration<=0)throw new RangeError('Playback duration must be positive.');
 const state={progress:0,playing:false,speed:1};
 let destroyed=false,epoch=0,timer=null,anchorTime=0,anchorProgress=0,target=1;
 let desired=null,inFlight=null,ticket=0,settledTicket=0;
 const waiters=[];
 const getState=()=>({...state});
 const notify=()=>onChange(getState());
 const stopTimer=()=>{if(timer!==null){cancel(timer);timer=null;}};
 function settle(through){
  settledTicket=Math.max(settledTicket,through);
  for(let index=waiters.length-1;index>=0;index--)if(waiters[index].ticket<=settledTicket)waiters.splice(index,1)[0].resolve(getState());
 }
 function waitFor(through){
  return through<=settledTicket?Promise.resolve(getState()):new Promise(resolve=>waiters.push({ticket:through,resolve}));
 }
 function drain(){
  if(inFlight||!desired||destroyed)return;
  const frame=desired;desired=null;
  const flight=Promise.resolve().then(()=>{
   if(!destroyed&&frame.epoch===epoch)return render(frame.progress);
  });
  inFlight=flight;
  flight.catch(error=>{
   if(destroyed||frame.epoch!==epoch)return;
   state.playing=false;stopTimer();desired=null;epoch++;
   notify();onError(error);
  }).finally(()=>{
   inFlight=null;
   // A cancelled queued request must also settle, even though it never renders.
   settle(desired?frame.ticket:ticket);
   drain();
  });
 }
 function frame(progress){
  const next=++ticket;desired={progress,epoch,ticket:next};
  const result=waitFor(next);drain();return result;
 }
 function sample(){return Math.min(target,anchorProgress+Math.max(0,now()-anchorTime)*state.speed/duration);}
 function anchor(){anchorProgress=state.progress;anchorTime=now();}
 function scheduleNext(){
  if(!state.playing||destroyed||timer!==null)return;
  const generation=epoch;
  timer=schedule(()=>{
   timer=null;if(destroyed||!state.playing||generation!==epoch)return;
   state.progress=sample();if(state.progress>=target)state.playing=false;
   notify();void frame(state.progress);scheduleNext();
  });
 }
 function playTo(until){
  if(!Number.isFinite(until)||until<0||until>1)throw new RangeError('Playback target must be between 0 and 1.');
  if(destroyed)return Promise.resolve(getState());
  if(until===0)return seek(0);
  if(state.playing&&target===until)return waitFor(ticket);
  if(state.playing){state.progress=sample();stopTimer();epoch++;}
  target=until;if(state.progress>=target)state.progress=0;
  state.playing=true;anchor();notify();
  const result=frame(state.progress);scheduleNext();return result;
 }
 const play=()=>playTo(1);
 function pause(){
  if(destroyed||!state.playing)return waitFor(ticket);
  state.progress=sample();state.playing=false;stopTimer();epoch++;notify();
  return frame(state.progress);
 }
 function seek(progress){
  if(!Number.isFinite(progress)||progress<0||progress>1)throw new RangeError('Playback progress must be between 0 and 1.');
  if(destroyed)return Promise.resolve(getState());
  state.playing=false;state.progress=progress;stopTimer();epoch++;anchor();notify();
  return frame(progress);
 }
 function setSpeed(speed){
  if(![.25,.5,1,2].includes(speed))throw new RangeError('Playback speed must be .25, .5, 1, or 2.');
  if(destroyed)return Promise.resolve(getState());
  const playing=state.playing;
  if(playing){state.progress=sample();if(state.progress>=target)state.playing=false;}
  state.speed=speed;anchor();notify();
  if(!playing)return waitFor(ticket);
  stopTimer();epoch++;
  const result=frame(state.progress);scheduleNext();return result;
 }
 function invalidate(){
  state.playing=false;stopTimer();epoch++;desired=null;
  const through=ticket;
  // Ignore failure from an obsolete host; current render failures go to onError.
  return Promise.resolve(inFlight).catch(()=>{}).then(()=>{settle(through);return getState();});
 }
 function reset(){
  if(destroyed)return Promise.resolve(getState());
  const done=invalidate();state.progress=0;anchor();notify();return done;
 }
 function destroy(){
  if(destroyed)return Promise.resolve(inFlight).catch(()=>{}).then(getState);
  const done=invalidate();destroyed=true;notify();return done;
 }
 return {play,playTo,pause,seek,setSpeed,reset,destroy,getState};
}
