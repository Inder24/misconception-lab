// In-memory, opt-in hackathon diagnostics. Never records request bodies or credentials.
export function createDebugJournal(limit=180){
 let events=[];const listeners=new Set();const active=new Map();
 const notify=()=>{for(const listener of listeners)listener();};
 return {active,entries:()=>events.slice(),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 add({stage='lab',detail='',status='info'}={}){events.push({stage:String(stage).slice(0,60),detail:String(detail).slice(0,2000),status,at:Date.now()});events=events.slice(-limit);notify();},
 clear(){events=[];notify();}};
}
export function traceRequest(request,journal,onCode=()=>{}){
 return async(path,body,options)=>{
  const id=Symbol(),started=Date.now(),route=String(path).replace('/api/','');
  journal.active.set(id,{route,started});journal.add({stage:route,detail:'Request sent to server · awaiting Astra',status:'running'});
  try{
   const result=await request(path,body,options);
   if(result.lesson?.code){onCode(result.lesson.code);journal.add({stage:'code',detail:`Received ${result.lesson.code.length.toLocaleString()} characters of JavaScript · awaiting sandbox checks`,status:'info'});}
   journal.add({stage:route,detail:`Response received · ${((Date.now()-started)/1000).toFixed(1)}s${typeof result.passed==='boolean'?` · review ${result.passed?'passed':'needs repair'}`:''}`,status:'passed'});
   return result;
  }catch(error){journal.add({stage:route,detail:error.message||'Request failed',status:error.name==='AbortError'?'cancelled':'failed'});throw error;}
  finally{journal.active.delete(id);}
 };
}
export function setupDebugPanel(){
 const journal=createDebugJournal(),byId=id=>document.getElementById(id);
 const panel=byId('debug-panel'),toggle=byId('debug-toggle'),feed=byId('debug-feed'),status=byId('debug-status');
 const setOpen=open=>{panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));document.body.classList.toggle('debug-open',open);};
 toggle.addEventListener('click',()=>setOpen(panel.hidden));
 byId('debug-close').addEventListener('click',()=>{setOpen(false);toggle.focus();});
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen(false);toggle.focus();}});
 byId('debug-clear').addEventListener('click',()=>{journal.clear();byId('debug-code').textContent='No generated code captured yet.';});
 const render=()=>{
  const follow=byId('debug-follow').checked;feed.replaceChildren();
  for(const event of journal.entries()){
   const row=document.createElement('li');row.dataset.status=event.status;
   const meta=document.createElement('div'),time=document.createElement('time'),tag=document.createElement('strong'),detail=document.createElement('p');
   time.textContent=new Date(event.at).toLocaleTimeString();tag.textContent=`${event.stage} · ${event.status}`;detail.textContent=event.detail;
   meta.append(time,tag);row.append(meta,detail);feed.append(row);
  }
  byId('debug-count').textContent=`${journal.entries().length} events`;
  if(follow)feed.scrollTop=feed.scrollHeight;
 };
 journal.subscribe(render);
 const timer=setInterval(()=>{if(panel.hidden)return;status.textContent=journal.active.size?[...journal.active.values()].map(x=>`${x.route} · ${Math.floor((Date.now()-x.started)/1000)}s elapsed`).join(' / '):'Idle · ready for the next action';},500);
 addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 journal.add({stage:'lab',detail:'Debug capture ready. Open a reference lab or ask Astra to build an experiment.'});
 return {journal,setCode(code){byId('debug-code').textContent=String(code).slice(0,16000);}};
}
