import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayback} from '../public/playback.js';

function clock(){
 let time=0,serial=0;const timers=new Map();
 return {now:()=>time,schedule:fn=>{timers.set(++serial,fn);return serial;},cancel:id=>timers.delete(id),advance:ms=>{time+=ms;const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());},get pending(){return timers.size;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('play, pause, speed changes and restart use elapsed time without changing a paused position',async()=>{
 const time=clock(),frames=[],changes=[];
 const playback=createPlayback({...time,duration:1000,render:async progress=>frames.push(progress),onChange:state=>changes.push(state)});
 await playback.play();time.advance(250);await flush();
 assert.equal(playback.getState().progress,.25);
 await playback.pause();time.advance(500);await flush();
 assert.deepEqual(playback.getState(),{progress:.25,playing:false,speed:1});
 await playback.setSpeed(2);await playback.play();time.advance(250);await flush();
 assert.equal(playback.getState().progress,.75);
 time.advance(125);await flush();
 assert.deepEqual(playback.getState(),{progress:1,playing:false,speed:2});
 await playback.play();assert.equal(frames.at(-1),0);
 assert.equal(changes.at(-1).playing,true);
 await playback.destroy();assert.equal(time.pending,0);
});

test('seeks coalesce while a render is pending and render calls never overlap',async()=>{
 const time=clock(),frames=[];let finish,active=0,maxActive=0;
 const playback=createPlayback({...time,render:async progress=>{frames.push(progress);maxActive=Math.max(maxActive,++active);if(frames.length===1)await new Promise(resolve=>finish=resolve);active--;}});
 const first=playback.play();await flush();
 const middle=playback.seek(.4),latest=playback.seek(.8);
 assert.deepEqual(playback.getState(),{progress:.8,playing:false,speed:1});
 finish();await Promise.all([first,middle,latest]);
 assert.deepEqual(frames,[0,.8]);assert.equal(maxActive,1);
 await playback.destroy();
});

test('changing speed while playing applies the new speed only to subsequent elapsed time',async()=>{
 const time=clock(),frames=[];
 const playback=createPlayback({...time,duration:1000,render:async progress=>frames.push(progress)});
 await playback.play();time.advance(200);await flush();
 await playback.setSpeed(.5);assert.equal(playback.getState().progress,.2);
 time.advance(200);await flush();
 assert.ok(Math.abs(playback.getState().progress-.3)<1e-12);
 await playback.setSpeed(2);time.advance(100);await flush();
 assert.equal(playback.getState().progress,.5);assert.equal(frames.at(-1),.5);
 await playback.reset();assert.deepEqual(playback.getState(),{progress:0,playing:false,speed:2});
 await playback.destroy();
});

test('reset cancels queued frames without rendering zero and waits for the old renderer before a host can change',async()=>{
 const time=clock(),frames=[];let finish;
 const playback=createPlayback({...time,duration:1000,render:async progress=>{frames.push(progress);await new Promise(resolve=>finish=resolve);}});
 const playing=playback.play();await flush();time.advance(400);
 let resetDone=false;const resetting=playback.reset().then(()=>resetDone=true);
 assert.deepEqual(playback.getState(),{progress:0,playing:false,speed:1});
 assert.equal(resetDone,false);
 finish();await Promise.all([playing,resetting]);time.advance(1000);await flush();
 assert.deepEqual(frames,[0]);assert.equal(time.pending,0);
 await playback.destroy();
});

test('destroy invalidates queued seeks and a late rejected frame cannot report an error or restart rendering',async()=>{
 const time=clock(),frames=[],errors=[];let rejectFrame;
 const playback=createPlayback({...time,render:progress=>{frames.push(progress);return new Promise((resolve,reject)=>rejectFrame=reject);},onError:error=>errors.push(error)});
 const playing=playback.play();await flush();const seeking=playback.seek(.5),destroying=playback.destroy();
 rejectFrame(new Error('Old host was removed'));await Promise.all([playing,seeking,destroying]);
 await playback.play();await playback.seek(.7);time.advance(2000);await flush();
 assert.deepEqual(frames,[0]);assert.deepEqual(errors,[]);assert.equal(time.pending,0);
});

test('a current renderer failure pauses playback and reports the failure once; invalid inputs cannot corrupt state',async()=>{
 const time=clock(),errors=[];
 const playback=createPlayback({...time,render:async()=>{throw new Error('Sandbox timed out');},onError:error=>errors.push(error.message)});
 await playback.play();await flush();
 assert.equal(playback.getState().playing,false);assert.deepEqual(errors,['Sandbox timed out']);assert.equal(time.pending,0);
 for(const value of [-.1,1.1,NaN])assert.throws(()=>playback.seek(value),RangeError);
 for(const value of [0,3,NaN])assert.throws(()=>playback.setSpeed(value),RangeError);
 assert.deepEqual(playback.getState(),{progress:0,playing:false,speed:1});
 await playback.destroy();
});
