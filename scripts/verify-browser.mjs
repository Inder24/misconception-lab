import {createDevServer} from './dev.mjs';
import {createFixtureFetcher} from '../test/fixtures/openai-responses.mjs';
// Fixture-only upload helper exercises the real file-change handler and decoder
// when the automation browser cannot operate its native OS file picker.
const helper=`<aside style="padding:12px;background:#fff0ce;text-align:center">Verification fixture · OpenAI responses are simulated. <button id="fixture-upload">Use sample teaching screenshot</button></aside><script type="module">
document.getElementById('fixture-upload').onclick=async()=>{
 document.getElementById('tab-planner').click();
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1000;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1200,1000);c.fillStyle='#263d31';c.font='32px sans-serif';
 ['Misconception Identifier','Topic: Photosynthesis in plants','Grade 5 · Science','Plants only need sunlight to grow.','Plants do not use oxygen.','Plants get their food from soil.','Include quick questions: Yes'].forEach((line,i)=>c.fillText(line,70,100+i*110));
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob],'teaching-screenshot.png',{type:'image/png'}));
 const input=document.getElementById('brief-image-input');if(input.disabled)return;input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
};</script>`;
const server=createDevServer({env:{OPENAI_API_KEY:'controlled-browser-fixture'},fetcher:createFixtureFetcher(),transformHTML:html=>html.replace('</body>',helper+'</body>')});
server.listen(0,'127.0.0.1',()=>console.log(`Controlled browser test server: http://127.0.0.1:${server.address().port}\nOpenAI responses are simulated. No remote API calls. The first generation deliberately fails so the real sandbox/repair flow is exercised.`));
