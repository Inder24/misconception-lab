import {fallingState} from './falling-model.js';

// This panel controls only the authored drop model. Generated code remains isolated.
export function setupDropLab({onChange,onSeek,onError}){
  const $=id=>document.getElementById(id);
  let current=null,enabled=false,view=null,lastParams='',restoreHeightFocus=false;
  const change=patch=>{if(enabled)Promise.resolve(onChange(patch)).catch(onError);};
  const seek=progress=>{if(enabled&&view)Promise.resolve(onSeek(progress)).catch(onError);};
  $('drop-vacuum').addEventListener('click',()=>change({air:0}));
  $('drop-air').addEventListener('click',()=>change({air:1}));
  $('drop-match').addEventListener('click',()=>change({mass_b:current.mass_a}));
  $('drop-swap').addEventListener('click',()=>change({mass_a:current.mass_b,mass_b:current.mass_a}));
  $('drop-height').addEventListener('input',()=>{
    $('drop-height-value').textContent=$('drop-height').value+' m';
    $('drop-height').setAttribute('aria-valuetext',$('drop-height').value+' metres');
  });
  $('drop-height').addEventListener('change',()=>change({height:Number($('drop-height').value)}));
  $('drop-release').addEventListener('click',()=>seek(0));
  $('drop-landing-a').addEventListener('click',()=>seek(view.a.landingTime/view.duration));
  $('drop-landing-b').addEventListener('click',()=>seek(view.b.landingTime/view.duration));
  function update({active,params,revealed,busy,ready}){
    current=params;enabled=active&&revealed&&!busy&&ready;
    if(!enabled&&document.activeElement===$('drop-height'))restoreHeightFocus=true;
    document.querySelector('.workbench').classList.toggle('falling-workbench',active);
    for(const id of ['drop-controls','drop-discovery'])$(id).hidden=!active;
    for(const id of ['drop-height-control','drop-moments'])$(id).hidden=!active||!revealed;
    for(const id of ['drop-controls','drop-height-control','drop-discovery','drop-moments'])for(const input of $(id).querySelectorAll('button,input'))input.disabled=!enabled;
    if(!active){view=null;lastParams='';restoreHeightFocus=false;return;}
    if(enabled&&restoreHeightFocus){if(document.activeElement===document.body)$('drop-height').focus({preventScroll:true});restoreHeightFocus=false;}
    $('drop-vacuum').setAttribute('aria-pressed',String(params.air===0));
    $('drop-air').setAttribute('aria-pressed',String(params.air===1));
    document.querySelector('.drop-fair-test strong').textContent=params.mass_a===params.mass_b?'Equal masses.':'Different masses.';
    $('drop-drag-hint').textContent=revealed?'↕ Drag the height handle, release, and watch them fall.':'Make your prediction to unlock the chamber controls.';
    const key=JSON.stringify(params);
    if(key!==lastParams){
      lastParams=key;$('drop-height').value=params.height;$('drop-height-value').textContent=params.height+' m';$('drop-height').setAttribute('aria-valuetext',params.height+' metres');
    }
    // No outcome or arrival time is computed/displayed before the learner runs.
    if(!revealed||!ready){view=null;return;}
    view=fallingState(params,1);
    const tie=view.gap<.001;
    $('drop-landing-a').textContent=(tie?'Both land · ':'A lands · ')+view.a.landingTime.toFixed(2)+' s';
    $('drop-landing-b').textContent='B lands · '+view.b.landingTime.toFixed(2)+' s';$('drop-landing-b').hidden=tie;
    $('drop-insight').textContent=params.air===0?'No air to push back: changing mass does not change the fall time. Try adding air.':params.mass_a===params.mass_b?'Same mass, same size, same drag: they move together even with air. Try different masses.':'Same size means the same drag coefficient here. At the same speed, air slows the lighter ball more. Try matching their masses.';
  }
  function frame(progress){
    if(!view)return;
    $('drop-clock').textContent=(view.duration*progress).toFixed(2)+' s';
    for(const [id,position]of [['drop-release',0],['drop-landing-a',view.a.landingTime/view.duration],['drop-landing-b',view.b.landingTime/view.duration]])$(id).setAttribute('aria-pressed',String(Math.abs(progress-position)<.002));
  }
  return {update,frame};
}
