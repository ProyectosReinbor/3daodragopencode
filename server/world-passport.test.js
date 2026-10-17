import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountFoodieWorld } from './foodie-world.js';
import { PASSPORT_VENUES, PASSPORT_REWARD, canVisitVenue, visitVenue, passportCount } from '../shared/world-passport.js';
import { CITY_BUILDINGS } from '../shared/city-life.js';
test('passport accepts venue entrances and interiors, and grants completion only once',()=>{
  const world={};
  assert.equal(passportCount(world),0);
  assert.throws(()=>visitVenue(world,'missing',{x:0,z:0}));
  assert.throws(()=>visitVenue(world,PASSPORT_VENUES[0].id,{x:NaN,z:0}));
  assert.equal(world.visitedVenues,undefined);
  for(const [i,venue] of PASSPORT_VENUES.entries()) {
    const building=CITY_BUILDINGS.find((b)=>b.id===venue.buildingId);
    assert.equal(canVisitVenue(venue.id,building),true);
    assert.equal(canVisitVenue(venue.id,{x:99999,z:99999}),false);
    assert.deepEqual(visitVenue(world,venue.id,venue),i===PASSPORT_VENUES.length-1?PASSPORT_REWARD:null);
    assert.equal(visitVenue(world,venue.id,venue),null);
  }
  assert.equal(passportCount(world),PASSPORT_VENUES.length);
  assert.equal(world.visitedVenues.length,PASSPORT_VENUES.length);
});
test('passport visits persist and completion cannot be claimed again in a new session',async()=>{
  let profile={characters:{characters:[{id:'pet',level:1,xp:0,baseStats:{atk:6,def:6,spd:6,hp:6,ability:6},upgrades:[]}]}};
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
    const first=PASSPORT_VENUES[0];
    assert.equal((await request({action:'visit_venue',venue:first.id,position:first},'action','other')).status,409);
    assert.equal((await request({action:'visit_venue',venue:first.id,position:{x:0,z:0}})).status,400);
    for(const venue of PASSPORT_VENUES)assert.equal((await request({action:'visit_venue',venue:venue.id,position:venue})).status,200);
    assert.equal(profile.world.coins,40+PASSPORT_REWARD.coins);
    assert.equal(profile.world.passportRewarded,true);
    const earned=structuredClone(profile);
    const start=await request({characterId:'pet'},'start');session=start.data.session;
    assert.equal(start.data.profile.world.visitedVenues.length,PASSPORT_VENUES.length);
    assert.equal((await request({action:'visit_venue',venue:first.id,position:first})).data.reward,null);
    assert.deepEqual(profile,earned);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
