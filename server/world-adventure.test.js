import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountFoodieWorld } from './foodie-world.js';
import { CITY_WORLD } from '../shared/city-world.js';

test('world resources, timed mining, crafting and quest rewards persist without duplicate claims', async () => {
  let now=100000;
  let profile={characters:{selectedId:'pet',characters:[{id:'pet',name:'QA',level:1,xp:0,baseStats:{atk:8,ability:8,def:8,spd:8,hp:8},upgrades:[]}]}};
  const app=express();app.use(express.json());
  mountFoodieWorld(app,{clock:()=>now,auth:(req,res,next)=>{if(req.headers.authorization!=='Bearer QA')return res.status(401).json({error:'Unauthorized'});req.phone=req.headers['x-user']||'a';next();},getProfile:()=>structuredClone(profile),saveProfile:(_phone,p)=>{profile=structuredClone(p);}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  let session;
  async function request(body,path='/action',user='a'){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/world${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer QA','x-user':user},body:JSON.stringify({...body,session})});return {status:r.status,data:await r.json()};}
  try {
    session=(await request({characterId:'pet'},'/start')).data.session;
    assert.equal((await request({action:'accept_quest',quest:'supplies'},'/action','b')).status,409);
    assert.equal((await request({action:'accept_quest',quest:'supplies'})).status,200);
    assert.equal((await request({action:'claim_quest',quest:'supplies'})).status,400);
    for(const id of ['starter-wood','starter-crystal','starter-essence']){
      const node=CITY_WORLD.nodes.find(n=>n.id===id);
      assert.equal((await request({action:'pickup',node:id,position:{x:0,z:0}})).status,400);
      assert.equal((await request({action:'pickup',node:id,amount:999,position:node})).status,200);
      assert.equal((await request({action:'pickup',node:id,position:node})).status,429);
    }
    const node=CITY_WORLD.nodes.find(n=>n.id==='starter-ore');
    let begin=await request({action:'begin_gather',node:node.id,position:node});
    const gather={action:'gather',node:node.id,position:node,token:begin.data.challenge.token};
    assert.equal((await request(gather)).status,400);now+=3100;
    assert.equal((await request(gather)).status,200);
    assert.equal(profile.world.gathered,6);
    const claim={action:'claim_quest',quest:'supplies'};
    assert.equal((await request(claim)).status,200);const coins=profile.world.coins;
    assert.equal((await request(claim)).status,400);assert.equal(profile.world.coins,coins);
    assert.equal((await request({action:'craft',recipe:'hoja',position:CITY_WORLD.forge})).status,400);
    assert.equal(profile.world.materials.madera,2);
    now+=31000;begin=await request({action:'begin_gather',node:node.id,position:node});now+=3100;
    assert.equal((await request({...gather,token:begin.data.challenge.token})).status,200);
    assert.equal((await request({action:'craft',recipe:'hoja',position:{x:999,z:999}})).status,400);
    assert.equal((await request({action:'craft',recipe:'hoja',position:CITY_WORLD.forge})).status,200);
    assert.equal((await request({action:'craft',recipe:'hoja',position:CITY_WORLD.forge})).data.reward.alreadyCrafted,true);
    assert.equal(profile.world.crafted,1);assert.equal(profile.world.materials.mineral,0);
    await request({action:'accept_quest',quest:'artisan'});
    assert.equal((await request({action:'claim_quest',quest:'artisan'})).status,200);
    assert.equal((await request({action:'attack',slot:3,enemy:'city:999999',kind:'wolf'})).status,400);
    assert.equal((await request({action:'attack',slot:3,enemy:'city:0',kind:'wolf'})).status,200);
    assert.equal(profile.world.kills,1);
    session=(await request({characterId:'pet'},'/start')).data.session;
    assert.equal((await request(claim)).status,400);
    assert.equal((await request({action:'pickup',node:'starter-wood',position:CITY_WORLD.nodes.find(n=>n.id==='starter-wood')})).status,429);
  } finally {await new Promise(r=>server.close(r));}
});
