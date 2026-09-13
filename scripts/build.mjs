import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {build} from 'esbuild';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
const assets={};
for(const name of await readdir('public'))assets['/'+name]=await readFile('public/'+name,'utf8');
assets['/']=assets['/index.html'];
const entry=`import {handleAPI} from './server/api.mjs';
const ASSETS=${JSON.stringify(assets)};
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path.startsWith('/api/'))return handleAPI(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const body=ASSETS[path];if(body===undefined)return new Response('Not found',{status:404});
 const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html';
 return new Response(request.method==='HEAD'?null:body,{headers:{'content-type':type+'; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-cache','referrer-policy':'no-referrer'}});
}};`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'worker-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js'});
console.log(`Built Worker with API and ${Object.keys(assets).length} frontend assets.`);
