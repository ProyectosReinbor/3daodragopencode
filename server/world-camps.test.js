import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountFoodieWorld } from './foodie-world.js';
import { WORLD_CAMPS, activeCamp, activateCamp } from '../shared/world-camps.js';
test('return beacons require a known nearby destination and keep legacy profiles valid', () => {
  const world = {};
  assert.equal(activeCamp(world),null);
  assert.equal(WORLD_CAMPS.length,4);
  assert.equal(new Set(WORLD_CAMPS.map(c=>c.id)).size,4);
  const camp = WORLD_CAMPS[1];
  assert.throws(()=>activateCamp(world,camp.id,{x:0,z:0}));
  assert.throws(()=>activateCamp(world,camp.id,{x:NaN,z:camp.z}));
  assert.throws(()=>activateCamp(world,'missing',camp));
  assert.equal(world.campId,undefined);
  activateCamp(world,camp.id,camp);
  assert.equal(activeCamp(world).id,camp.id);
});
test('authenticated beacon activation persists across sessions without granting resources', async () => {
  let profile={characters:{characters:[{id:'pet',level:1,xp:0,baseStats:{atk:6,def:6,spd:6,hp:6,ability:6}}]}};
  const app=express();app.use(express.json());
  mountFoodieWorld(app,{auth:(req,res,next)=>{req.phone=req.headers['x-user']||'owner';next();},getProfile:()=>structuredClone(profile),saveProfile:(_phone,p)=>{profile=structuredClone(p);}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  let session;
  const request=async(body,path='action',user='owner')=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/world/${path}`,{method:'POST',headers:{'Content-Type':'application/json','x-user':user},body:JSON.stringify({...body,session})});
    return {status:response.status,data:await response.json()};
  };
  try {
    session=(await request({characterId:'pet'},'start')).data.session;
    const before=structuredClone(profile.world),camp=WORLD_CAMPS[0];
    assert.equal((await request({action:'activate_camp',camp:camp.id,position:camp},'action','other')).status,409);
    assert.equal((await request({action:'activate_camp',camp:camp.id,position:{x:9999,z:9999}})).status,400);
    assert.equal((await request({action:'activate_camp',camp:camp.id,position:camp})).status,200);
    assert.deepEqual(profile.world,{...before,campId:camp.id});
    const restarted=await request({characterId:'pet'},'start');
    assert.equal(restarted.data.profile.world.campId,camp.id);
    assert.equal((await request({action:'activate_camp',camp:camp.id,position:camp})).status,409);
    session=restarted.data.session;
    assert.equal((await request({action:'activate_camp',camp:camp.id,position:camp})).status,200);
    assert.deepEqual(profile.world,{...before,campId:camp.id});
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
