import { attackPosition } from './combat-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountFoodieWorld } from './foodie-world.js';
import { CITY_WORLD, CITY_ENCOUNTERS } from '../shared/city-world.js';

test('world resources, timed mining, crafting and quest rewards persist without duplicate claims', async () => {
  let now=100000;
  let profile={characters:{selectedId:'pet',characters:[{id:'pet',name:'QA',level:1,xp:0,baseStats:{atk:8,ability:8,def:8,spd:8,hp:8},upgrades:[]}]}};
  const app=express();app.use(express.json());
  mountFoodieWorld(app,{clock:()=>now,auth:(req,res,next)=>{if(req.headers.authorization!=='Bearer QA')return res.status(401).json({error:'Unauthorized'});req.phone=req.headers['x-user']||'a';next();},getProfile:()=>structuredClone(profile),saveProfile:(_phone,p)=>{profile=structuredClone(p);}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  let session;
  async function request(body,path='/action',user='a'){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/world${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer QA','x-user':user},body:JSON.stringify({...attackPosition(body),session})});return {status:r.status,data:await r.json()};}
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
    assert.equal(profile.world.monsterKills.wolf,1);
    const parkIndex=CITY_ENCOUNTERS.findIndex(e=>e.park);
    await request({action:'accept_quest',quest:'park_patrol'});
    assert.equal((await request({action:'claim_quest',quest:'park_patrol'})).status,400);
    for(let i=0;i<8;i++){now+=25000;assert.equal((await request({action:'attack',slot:3,enemy:'city:'+parkIndex,kind:CITY_ENCOUNTERS[parkIndex].kind})).status,200);}
    assert.equal(profile.world.parkKills,8);
    assert.equal(profile.world.monsterKills[CITY_ENCOUNTERS[parkIndex].kind],9);
    now+=1000;
    assert.equal((await request({action:'attack',slot:-1,enemy:'city:'+parkIndex,kind:CITY_ENCOUNTERS[parkIndex].kind})).status,400);
    assert.equal(profile.world.monsterKills[CITY_ENCOUNTERS[parkIndex].kind],9);
    assert.equal((await request({action:'claim_quest',quest:'park_patrol'})).status,200);
    const parkCoins=profile.world.coins;
    assert.equal((await request({action:'claim_quest',quest:'park_patrol'})).status,400);
    assert.equal(profile.world.coins,parkCoins);
    session=(await request({characterId:'pet'},'/start')).data.session;
    assert.equal((await request(claim)).status,400);
    assert.equal(profile.world.claimedQuests.includes('park_patrol'),true);
    assert.equal((await request({action:'adventure_start',position:{x:100,z:100}})).status,400);
    const guide={x:-5,z:-5};
    assert.equal((await request({action:'adventure_start',position:guide})).status,200);
    assert.equal((await request({action:'adventure_advance',stage:0,position:guide})).status,400);
    session=(await request({characterId:'pet'},'/start')).data.session;
    assert.equal(profile.world.adventure.stage,0);
    for(const id of ['starter-wood','starter-crystal','starter-essence'])assert.equal((await request({action:'pickup',node:id,position:CITY_WORLD.nodes.find(n=>n.id===id)})).status,200);
    begin=await request({action:'begin_gather',node:node.id,position:node});now+=3100;
    assert.equal((await request({...gather,token:begin.data.challenge.token})).status,200);
    assert.equal((await request({action:'adventure_advance',stage:1,position:guide})).status,400);
    assert.equal((await request({action:'adventure_advance',stage:0,position:guide})).status,200);
    assert.equal((await request({action:'adventure_advance',stage:0,position:guide})).status,400);
    for(let i=0;i<3;i++){now+=25000;assert.equal((await request({action:'attack',slot:3,enemy:'city:'+parkIndex,kind:CITY_ENCOUNTERS[parkIndex].kind})).status,200);}
    assert.equal((await request({action:'adventure_advance',stage:1,position:guide})).status,200);
    assert.equal((await request({action:'adventure_advance',stage:2,position:guide})).status,200);
    assert.equal((await request({action:'adventure_advance',stage:3,position:guide})).status,400);
    assert.equal((await request({action:'equip',item:'explorer_blade'})).status,200);
    assert.equal((await request({action:'adventure_advance',stage:3,position:guide})).status,200);
    assert.equal((await request({action:'adventure_advance',stage:4,position:{x:999,z:999}})).status,400);
    const beforeReward=profile.world.coins, beforePotions=profile.world.potions;
    assert.equal((await request({action:'adventure_advance',stage:4,position:guide})).status,200);
    assert.equal(profile.world.coins,beforeReward+75);assert.equal(profile.world.potions,beforePotions+2);
    session=(await request({characterId:'pet'},'/start')).data.session;
    assert.equal(profile.world.adventure.completed,true);
    assert.equal((await request({action:'adventure_advance',stage:4,position:guide})).status,400);
    assert.equal((await request({action:'adventure_start',position:guide})).status,400);
    assert.equal(profile.world.coins,beforeReward+75);
  } finally {await new Promise(r=>server.close(r));}
});
