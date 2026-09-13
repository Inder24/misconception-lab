import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createDevServer} from '../scripts/dev.mjs';

async function withServer(fn){const server=createDevServer({env:{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await fn(server.address().port);}finally{await new Promise(r=>server.close(r));}}
function get(port,host){return new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:'/api/status',headers:{host}},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,body}));}).on('error',reject);});}
test('loopback dev identity is not exposed through arbitrary DNS Host headers',()=>withServer(async port=>{const r=await get(port,'attacker.example:'+port);assert.equal(r.status,403);assert.ok(!r.body.includes('model'));}));
test('loopback app and API remain available with exact local origin',()=>withServer(async port=>{const r=await get(port,'127.0.0.1:'+port);assert.equal(r.status,200);assert.equal(JSON.parse(r.body).ready,false);const page=await fetch(`http://127.0.0.1:${port}/`);assert.equal(page.status,200);assert.ok((await page.text()).includes('Your lab partner'));}));
