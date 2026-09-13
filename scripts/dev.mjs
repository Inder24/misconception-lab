import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {handleAPI} from '../server/api.mjs';

// Exported so browser integration tests exercise the production UI/API with only
// the remote HTTP boundary substituted. The normal dev command always uses fetch.
export function createDevServer({env=process.env,fetcher=fetch,transformHTML}={}){
 const server=http.createServer(async(req,res)=>{
  const port=server.address()?.port;
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){
   res.writeHead(403,{'content-type':'text/plain'});res.end('Open the printed loopback URL directly.');return;
  }
  const controller=new AbortController();
  req.once('aborted',()=>controller.abort());
  res.once('close',()=>{if(!res.writableEnded)controller.abort();});
  try{
   const url=new URL(req.url,'http://'+req.headers.host);let response;
   if(url.pathname.startsWith('/api/')){
    const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','localhost-developer');
    const request=new Request(url,{method:req.method,headers,signal:controller.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
    response=await handleAPI(request,env,fetcher);
   }else{
    const path=url.pathname==='/'?'/index.html':url.pathname;
    if(!/^\/[a-z0-9.-]+$/.test(path))response=new Response('Not found',{status:404});
    else{
     const fixture=['/sandbox-check.html','/flow-check.html'].includes(path);
     try{let body=await readFile(new URL(fixture?'../test/fixtures'+path:'../public'+path,import.meta.url));if(path==='/index.html'&&transformHTML)body=transformHTML(body.toString());response=new Response(body,{headers:{'content-type':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}catch{response=new Response('Not found',{status:404});}
    }
   }
   if(res.destroyed)return;
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(response.body){for await(const chunk of response.body){if(res.destroyed)break;res.write(chunk);}}
   if(!res.destroyed)res.end();
  }catch(error){if(!res.destroyed){if(!res.headersSent)res.writeHead(500);res.end('Local server error.');}}
 });
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const server=createDevServer();
 const port=Number(process.env.PORT)||0;
 server.listen(port,'127.0.0.1',()=>console.log('Lab preview: http://127.0.0.1:'+server.address().port));
}
