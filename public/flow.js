const screens={
  home:{heading:'home-title',title:'A little doubt. A new discovery.'},
  choose:{heading:'choose-title',title:'Explore experiments'},
  create:{heading:'claim-heading',title:'Create an experiment'},
  lab:{heading:'lesson-title',title:'Your workbench'},
  shelf:{heading:'shelf-title',title:'My experiments'},
  planner:{heading:'brief-heading',title:'Plan a lesson'},
};
const aliases={'lesson-title':'lab',history:'shelf',claim:'create'};
let active=null,installed=false,lastURL='',callbacks={};
const known=name=>Object.hasOwn(screens,name);

function screenFromURL(url){
  let hash;try{hash=decodeURIComponent(url.hash.slice(1));}catch{return null;}
  if(hash)return known(hash)?hash:Object.hasOwn(aliases,hash)?aliases[hash]:null;
  return url.searchParams.has('lesson')?'lab':'home';
}

function render(name,{focus=true}={}){
  const previous=active,changed=previous!==name;
  active=name;
  for(const screen of Object.keys(screens)){
    const panel=document.getElementById(screen==='planner'?'panel-planner':'screen-'+screen);
    if(panel)panel.hidden=screen!==name;
  }
  document.getElementById('panel-experiment').hidden=name==='planner';
  document.body.dataset.screen=name;
  for(const [workspace,screen]of [['experiment','lab'],['planner','planner']]){
    const tab=document.getElementById('tab-'+workspace),selected=name===screen;
    if(tab){tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
  }
  for(const link of document.querySelectorAll('[data-screen-link]')){
    if(link.dataset.screenLink===name)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  document.title=`${screens[name].title} · Misconception Lab`;
  if(changed){
    if(previous==='lab')callbacks.onLeaveLab?.();
    if(name==='lab')callbacks.onEnterLab?.();
    if(name==='lab'||name==='planner')dispatchEvent(new CustomEvent('workspacechange',{detail:name==='lab'?'experiment':'planner'}));
    dispatchEvent(new CustomEvent('screenchange',{detail:name}));
  }
  if(focus){
    const pending=name==='lab'&&document.getElementById('screen-lab').classList.contains('is-building');
    const heading=document.getElementById(pending?'pending-title':screens[name].heading);
    if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
    window.scrollTo({top:0,left:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  return active;
}

export function currentScreen(){return active??(known(document.body.dataset.screen)?document.body.dataset.screen:'home');}

export function showScreen(name,{focus=true,replace=false}={}){
  if(!known(name))return currentScreen();
  const url=new URL(location.href);url.hash=name;
  if(url.href!==location.href)history[replace||active===name?'replaceState':'pushState'](history.state,'',url);
  lastURL=location.href;
  return render(name,{focus});
}

export function setupFlow({onLeaveLab,onEnterLab}={}){
  callbacks={onLeaveLab,onEnterLab};
  if(installed)return {showScreen,currentScreen};
  installed=true;
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target instanceof Element?event.target.closest('a[data-screen-link]'):null;
    if(!link||link.hasAttribute('download')||link.target&&link.target!=='_self'||!known(link.dataset.screenLink))return;
    if(new URL(link.href,location.href).origin!==location.origin)return;
    event.preventDefault();showScreen(link.dataset.screenLink);
  });
  const followHistory=()=>{
    if(location.href===lastURL)return;
    lastURL=location.href;
    const name=screenFromURL(new URL(location.href));
    if(name)render(name);
  };
  // A history traversal can emit both events. The URL guard handles it once.
  addEventListener('popstate',followHistory);
  addEventListener('hashchange',followHistory);
  showScreen(screenFromURL(new URL(location.href))??'home',{focus:false,replace:true});
  return {showScreen,currentScreen};
}
