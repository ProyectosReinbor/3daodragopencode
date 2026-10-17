import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { beginVenueGame, finishVenueGame } from './venue-game.js';
import { VENUE_GAME_REWARD } from '../shared/venue-game.js';
import { PASSPORT_VENUES } from '../shared/world-passport.js';
import { mountFoodieWorld } from './foodie-world.js';
const venue=PASSPORT_VENUES[0];
test('memory challenge consumes attempts and rejects early, expired and distant results',()=>{
  const session={},world={};
  assert.throws(()=>beginVenueGame(session,world,venue.id,{x:0,z:0},1000));
  let challenge=beginVenueGame(session,world,venue.id,venue,1000,()=>2);
  assert.throws(()=>finishVenueGame(session,world,challenge.token,[2,2,2],venue,2000));
  assert.throws(()=>finishVenueGame(session,world,challenge.token,[2,2,2],venue,5000));
  challenge=beginVenueGame(session,world,venue.id,venue,6000,()=>2);
  assert.equal(finishVenueGame(session,world,challenge.token,[2,1,2],venue,10000).won,false);
  assert.equal(world.venueGameCooldowns,undefined);
  challenge=beginVenueGame(session,world,venue.id,venue,11000,()=>2);
  assert.throws(()=>finishVenueGame(session,world,challenge.token,[2,2,2],venue,72000));
  challenge=beginVenueGame(session,world,venue.id,venue,73000,()=>2);
  assert.throws(()=>finishVenueGame(session,world,challenge.token,[2,2,2],{x:0,z:0},77000));
  challenge=beginVenueGame(session,world,venue.id,venue,78000,()=>2);
  assert.deepEqual(finishVenueGame(session,world,challenge.token,[2,2,2],venue,82000),{won:true,reward:VENUE_GAME_REWARD});
  assert.throws(()=>beginVenueGame({},world,venue.id,venue,83000));
  assert.doesNotThrow(()=>beginVenueGame({},world,venue.id,venue,82000+86400000));
});
test('memory reward persists across sessions and ignores client reward fields',async()=>{
  let now=100000,profile={characters:{characters:[{id:'pet',level:1,xp:0,baseStats:{atk:6,def:6,spd:6,hp:6,ability:6},upgrades:[]}]}};
  const app=express();app.use(express.json());
  mountFoodieWorld(app,{clock:()=>now,auth:(req,res,next)=>{req.phone=req.headers['x-user']||'owner';next();},getProfile:()=>structuredClone(profile),saveProfile:(_phone,p)=>{profile=structuredClone(p);}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  let session;
  const request=async(body,path='action',user='owner')=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/world/${path}`,{method:'POST',headers:{'Content-Type':'application/json','x-user':user},body:JSON.stringify({...body,session})});
    return {status:response.status,data:await response.json()};
  };
  try {
    session=(await request({characterId:'pet'},'start')).data.session;
    const begun=await request({action:'venue_game_start',venue:venue.id,position:venue});
    assert.equal(begun.status,200);
    const challenge=begun.data.challenge;
    now+=4000;
    const finish={action:'venue_game_finish',token:challenge.token,answers:challenge.pattern,position:venue,reward:{coins:99999}};
    assert.equal((await request(finish,'action','other')).status,409);
    assert.equal((await request(finish)).data.won,true);
    assert.equal(profile.world.coins,40+VENUE_GAME_REWARD.coins);
    assert.equal((await request(finish)).status,400);
    session=(await request({characterId:'pet'},'start')).data.session;
    assert.equal((await request({action:'venue_game_start',venue:venue.id,position:venue})).status,400);
    assert.equal(profile.world.coins,40+VENUE_GAME_REWARD.coins);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
