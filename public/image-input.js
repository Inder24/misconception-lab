// Image data is decoded locally and resized before any API request. Only the
// explicit upload/drawing action sends this image to the vision endpoint.
export async function prepareImage(file) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG, or WebP image.');
  if(file.size>12*1024*1024)throw Error('Choose an image smaller than 12 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const image=canvas.toDataURL('image/jpeg',.85);
    if(image.length>5_000_000)throw Error('This image is too large after resizing. Choose a smaller image.');
    return image;
  }finally{bitmap.close();}
}
export function setupImageInput({request,onClaim,onError,onBusy}) {
  const $=id=>document.getElementById(id);
  const canvas=$('sketch-canvas'),ctx=canvas.getContext('2d');
  let imageController=null,epoch=0,drawing=false,hasDrawing=false,last=null;
  const dialog=$('sketch-dialog');
  function clear(){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);hasDrawing=false;$('sketch-error').hidden=true;}
  clear();
  $('open-sketch').addEventListener('click',()=>dialog.showModal());
  $('clear-sketch').addEventListener('click',clear);
  const point=event=>{const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};};
  canvas.addEventListener('pointerdown',event=>{drawing=true;hasDrawing=true;last=point(event);canvas.setPointerCapture(event.pointerId);ctx.fillStyle='#285f42';ctx.beginPath();ctx.arc(last.x,last.y,2,0,2*Math.PI);ctx.fill();});
  canvas.addEventListener('pointermove',event=>{if(!drawing)return;const p=point(event);ctx.strokeStyle='#285f42';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drawing=false;last=null;});
  $('use-sketch').addEventListener('click',()=>{if(!hasDrawing){$('sketch-error').textContent='Draw an idea first, or add a photo instead.';$('sketch-error').hidden=false;return;}dialog.close();analyze(canvas.toDataURL('image/png'));});
  $('photo-input').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){onError('Choose a PNG, JPEG, or WebP image.');return;}
    if(file.size>12*1024*1024){onError('Choose an image smaller than 12 MB.');return;}
    const id=++epoch;imageController?.abort();imageController=null;onBusy(true);
    try{
      const image=await prepareImage(file);
      if(id!==epoch)return;
      await analyze(image);
    }catch(error){if(id===epoch){onBusy(false);$('image-status').textContent='The new image could not be read. Choose another photo or write your claim above.';onError(error.message||'The image could not be decoded. Try another photo.');}}
  });
  async function analyze(image){
    imageController?.abort();const controller=new AbortController();imageController=controller;const id=++epoch;
    const originalClaim=$('claim').value;
    $('visual-input').hidden=false;$('image-preview').src=image;$('image-regions').replaceChildren();$('image-observations').replaceChildren();$('image-uncertainty').textContent='';
    $('image-status').textContent='Looking at your image and finding a testable idea…';onBusy(true);
    try{
      const result=await request('/api/vision',{image,note:originalClaim},{signal:controller.signal});
      if(id!==epoch)return;
      if($('claim').value===originalClaim){onClaim(result.claim);$('image-status').textContent='Here is a possible interpretation. Does the claim above match your idea?';}
      else{$('image-status').textContent='Your edited claim has been kept. Suggested interpretation: '+result.claim;}
      result.observations.forEach(text=>{const li=document.createElement('li');li.textContent=text;$('image-observations').append(li);});
      result.regions.forEach((r,index)=>{const region=document.createElement('div');region.className='image-region';Object.assign(region.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'});const tag=document.createElement('span');tag.textContent=String(index+1);region.append(tag);region.title=r.label;$('image-regions').append(region);const li=document.createElement('li');li.textContent=`${index+1}. ${r.label}`;$('image-observations').append(li);});
      $('image-uncertainty').textContent=result.uncertainty;
    }catch(error){if(id===epoch&&error.name!=='AbortError'){$('image-status').textContent='The image could not be interpreted. You can write your own claim above.';onError(error.message);}}
    finally{if(id===epoch){imageController=null;onBusy(false);}}
  }
  function remove(){epoch++;imageController?.abort();imageController=null;$('visual-input').hidden=true;$('image-preview').removeAttribute('src');$('image-regions').replaceChildren();onBusy(false);}
  $('remove-image').addEventListener('click',remove);
  return {cancel:remove};
}
