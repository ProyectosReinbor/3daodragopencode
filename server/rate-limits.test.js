import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimit, createApiRateLimits } from './rate-limits.js';
function probe(limiter, req) {
  let status=200, data, allowed=false;const headers={};
  limiter({ip:'shared-ip',...req}, {set(key,value){headers[key]=value;return this;},status(value){status=value;return this;},json(value){data=value;return this;}},()=>{allowed=true;});
  return {status,data,headers,allowed};
}
test('world account budget permits basic attacks and position reports, isolates accounts and resets on server time',()=>{
  let now=100000;
  const limiter=createRateLimit({limit:300,clock:()=>now,key:req=>req.phone});
  for(let i=0;i<194;i++)assert.equal(probe(limiter,{phone:'a'}).allowed,true);
  for(let i=194;i<300;i++)assert.equal(probe(limiter,{phone:'a'}).allowed,true);
  const blocked=probe(limiter,{phone:'a'});
  assert.equal(blocked.status,429);assert.equal(blocked.headers['Retry-After'],'60');
  assert.equal(probe(limiter,{phone:'b'}).allowed,true);
  now+=59500;
  assert.equal(probe(limiter,{phone:'a'}).data.retryAfter,1);
  now+=500;
  assert.equal(probe(limiter,{phone:'a'}).allowed,true);
});
test('login and registration share ten attempts while admin and world have separate budgets',()=>{
  const limiter=createApiRateLimits({clock:()=>100000});
  for(let i=0;i<10;i++)assert.equal(probe(limiter,{path:i%2?'/register':'/login'}).allowed,true);
  assert.equal(probe(limiter,{path:'/login'}).status,429);
  assert.equal(probe(limiter,{path:'/LOGIN/'}).status,429);
  for(let i=0;i<10;i++)assert.equal(probe(limiter,{path:'/admin/login'}).allowed,true);
  assert.equal(probe(limiter,{path:'/admin/login'}).status,429);
  assert.equal(probe(limiter,{path:'/ADMIN/LOGIN/'}).status,429);
  for(let i=0;i<1200;i++)assert.equal(probe(limiter,{path:'/world/action'}).allowed,true);
  assert.equal(probe(limiter,{path:'/world/presence'}).status,429);
  assert.equal(probe(limiter,{path:'/world/action',ip:'other-ip'}).allowed,true);
});
test('world lookalike routes cannot use the larger world budget',()=>{
  const limiter=createApiRateLimits({clock:()=>100000});
  for(let i=0;i<100;i++)assert.equal(probe(limiter,{path:'/world-pretend'}).allowed,true);
  assert.equal(probe(limiter,{path:'/profile'}).status,429);
  assert.equal(probe(limiter,{path:'/world/start'}).allowed,true);
});
test('rejected attempts do not extend the retry deadline',()=>{
  let now=0;
  const limiter=createRateLimit({limit:1,clock:()=>now});
  assert.equal(probe(limiter,{}).allowed,true);
  now=30000;assert.equal(probe(limiter,{}).headers['Retry-After'],'30');
  now=59000;assert.equal(probe(limiter,{}).headers['Retry-After'],'1');
  now=60000;assert.equal(probe(limiter,{}).allowed,true);
});

import { mountFoodieWorld } from './foodie-world.js';
test('world routing authenticates before accounting and shares its budget across routes and sessions',()=>{
  const routes=new Map();
  let profile={characters:{characters:[{id:'pet'}]}};
  mountFoodieWorld({post:(path,...handlers)=>routes.set(path,handlers)}, {
    clock:()=>100000,
    auth:(req,res,next)=>{if(!req.owner)return res.status(401).json({error:'Unauthorized'});req.phone=req.owner;next();},
    getProfile:()=>structuredClone(profile),saveProfile:(_id,next)=>{profile=structuredClone(next);},
  });
  function call(path,owner,body={}) {
    let status=200,data,index=0;
    const handlers=routes.get('/api/world/'+path);
    const req={owner,body};
    const res={set(){return this;},status(value){status=value;return this;},json(value){data=value;return this;}};
    const next=()=>{const handler=handlers[index++];if(handler)handler(req,res,next);};next();
    return {status,data};
  }
  for(let i=0;i<305;i++)assert.equal(call('presence',null).status,401);
  assert.equal(call('start','owner',{characterId:'pet'}).status,200);
  for(let i=0;i<299;i++)assert.equal(call('presence','owner',{session:'invalid'}).status,409);
  assert.equal(call('action','owner',{session:'invalid'}).status,429);
  assert.equal(call('start','owner',{characterId:'pet'}).status,429);
  assert.equal(call('start','other',{characterId:'pet'}).status,200);
});
