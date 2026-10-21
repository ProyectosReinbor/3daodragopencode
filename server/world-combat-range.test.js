import test from 'node:test';
import assert from 'node:assert/strict';
import { validAttackPosition } from '../shared/world-combat-range.js';
import { mountFoodieWorld } from './foodie-world.js';
const spawn={x:3.5,z:-5};
const target={...spawn,y:0};
test('attack geometry rejects missing, nonfinite, distant, elevated and displaced targets',()=>{
  assert.equal(validAttackPosition(target,target,spawn,-1),true);
  assert.equal(validAttackPosition({...target,x:target.x+8},target,spawn,3),true);
  assert.equal(validAttackPosition({...target,x:target.x+8},target,spawn,-1),false);
  for(const position of [undefined,null,{x:NaN,y:0,z:0},{...target,y:10},{...target,x:20001},{...target,x:target.x+12}])
    assert.equal(validAttackPosition(position,target,spawn,3),false);
  assert.equal(validAttackPosition(target,{...target,y:4},spawn,3),false);
  const displaced={...target,x:target.x+31};
  assert.equal(validAttackPosition(displaced,displaced,spawn,3),false);
});
test('invalid attack geometry cannot spend mana, start cooldowns or grant rewards',()=>{
  let profile={characters:{characters:[{id:'pet',level:1,baseStats:{atk:8,ability:8},upgrades:[]}]}};
  const routes=new Map();
  mountFoodieWorld({post:(path,...handlers)=>routes.set(path,handlers.at(-1))},{auth:()=>{},clock:()=>100000,getProfile:()=>structuredClone(profile),saveProfile:(_id,next)=>{profile=structuredClone(next);}});
  let session;
  function call(path,body){let status=200;routes.get('/api/world/'+path)({phone:'qa',body},{status(code){status=code;return this;},json(data){if(data.session)session=data.session;return this;}});return status;}
  call('start',{characterId:'pet'});
  const before=structuredClone(profile);
  const attack={session,action:'attack',enemy:'aldea:0',kind:'wolf',slot:3};
  for(const body of [attack,{...attack,position:target},{...attack,position:{...target,y:10},enemyPosition:target},{...attack,position:{...target,x:100},enemyPosition:target}]){
    assert.equal(call('action',body),400);
    assert.deepEqual(profile,before);
  }
  const cityTarget={x:70,y:0,z:-25};
  assert.equal(call('action',{...attack,enemy:'city:00',position:cityTarget,enemyPosition:cityTarget}),400);
  assert.deepEqual(profile,before);
  assert.equal(call('action',{...attack,position:target,enemyPosition:target}),200);
  assert.equal(profile.world.combat.mana,60);
  assert.equal(profile.world.kills,1);
});
