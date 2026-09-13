import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {handleAPI} from '../server/api.mjs';
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+req.headers.host);let response;
  if(url.pathname.startsWith('/api/')){
   const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','localhost-developer');
   const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
   response=await handleAPI(request,process.env);
  }else{
   const path=['/','/misconception-lab.html'].includes(url.pathname)?'/index.html':url.pathname;
   if(!/^\/[a-z0-9.-]+$/.test(path))response=new Response('Not found',{status:404});
   else{try{const body=await readFile(path==='/sandbox-check.html'?'test/fixtures/sandbox-check.html':'public'+path);response=new Response(body,{headers:{'content-type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'}});}catch{response=new Response('Not found',{status:404});}}
  }
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Local server error.');}
});
server.listen(0,'127.0.0.1',()=>console.log('Lab preview: http://127.0.0.1:'+server.address().port));
