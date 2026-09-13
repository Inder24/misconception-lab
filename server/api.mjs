import {MODEL,handleLearningRequest} from './learning.mjs';
import {handleLiveRequest} from './live.mjs';
export {MODEL};
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
export async function handleAPI(request,env={},fetcher=fetch){
 const path=new URL(request.url).pathname;
 if(path==='/api/status'&&request.method==='GET')return json({ready:Boolean(env.OPENAI_API_KEY),model:MODEL,authenticated:Boolean(request.headers.get('oai-authenticated-user-id')?.trim())});
 const learning=await handleLearningRequest(request,env,fetcher);
 if(learning)return learning;
 const live=await handleLiveRequest(request,env,fetcher);
 return live??json({error:'Not found.'},404);
}
