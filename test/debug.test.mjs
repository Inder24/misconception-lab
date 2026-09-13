import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebugJournal,traceRequest} from '../public/debug-panel.js';
test('debug journal bounds history and drops arbitrary payload fields',()=>{
 const journal=createDebugJournal(2);
 journal.add({stage:'request',detail:'Started',body:{key:'secret'}});
 assert.equal(JSON.stringify(journal.entries()).includes('secret'),false);
 journal.add({stage:'test',detail:'one'});journal.add({stage:'test',detail:'two'});
 assert.deepEqual(journal.entries().map(x=>x.detail),['one','two']);
 journal.clear();assert.equal(journal.entries().length,0);
});
test('request trace captures returned code without logging request data',async()=>{
 const journal=createDebugJournal();let source;
 const call=traceRequest(async()=>({lesson:{code:'return {}'},model:'gpt-6-astra'}),journal,code=>source=code);
 const result=await call('/api/revise',{image:'private-image',claim:'private-claim'});
 assert.equal(result.lesson.code,source);assert.equal(journal.active.size,0);
 assert.ok(journal.entries().some(x=>x.status==='passed'));
 assert.doesNotMatch(JSON.stringify(journal.entries()),/private-image|private-claim/);
});
test('request errors and cancellation remain errors and clear pending state',async()=>{
 for(const name of ['Error','AbortError']){
 const journal=createDebugJournal();const error=Object.assign(new Error('Stopped'),{name});
 const call=traceRequest(async()=>{throw error;},journal);
 await assert.rejects(call('/api/revise',{}),e=>e===error);
 assert.equal(journal.active.size,0);assert.equal(journal.entries().at(-1).status,name==='AbortError'?'cancelled':'failed');
 }
});
