import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});
const assets={};for(const name of await readdir('public'))assets['/'+name]=await readFile('public/'+name,'utf8');assets['/']=assets['/index.html'];assets['/misconception-lab.html']=assets['/index.html'];
const schema=await readFile('public/lesson-schema.js','utf8');const api=(await readFile('server/api.mjs','utf8')).replace(/^import .*\n/,'');
const wrapper=`\nconst ASSETS=${JSON.stringify(assets)};\nexport default {async fetch(request,env){const path=new URL(request.url).pathname;if(path.startsWith('/api/'))return handleAPI(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const body=ASSETS[path];if(body===undefined)return new Response('Not found',{status:404});const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html';return new Response(request.method==='HEAD'?null:body,{headers:{'content-type':type+'; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-cache','referrer-policy':'no-referrer'}});}};`;
await writeFile('dist/server/index.js',schema+'\n'+api+wrapper);
console.log('Built Worker with server API and '+Object.keys(assets).length+' assets.');
