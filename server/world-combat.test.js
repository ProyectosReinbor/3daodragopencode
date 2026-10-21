import { attackPosition } from './combat-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { combatResources, powerRule, spendPower } from './world-combat.js';
import { mountFoodieWorld } from './foodie-world.js';

test('power selection uses owned loadout, classifies support, and rejects invalid slots', () => {
  const pet = { traits: { element: 'agua' } };
  assert.equal(powerRule(pet, 0).cost, 30);
  assert.equal(powerRule(pet, 0).support, true);
  assert.equal(powerRule({ powers: ['wind_blade', 'heal_wave'] }, 0).cost, 20);
  assert.equal(powerRule({ powers: ['invented'] }, 0).cost, 25);
  assert.equal(powerRule(pet, 2).support, true);
  for (const slot of [-2, 4, '0', null, 1.5]) assert.throws(() => powerRule(pet, slot));
});

test('mana is spent on server, regenerates by server time, caps and tolerates a backward clock', () => {
  const world = {};
  const combat = combatResources(world, 100000);
  const rule = powerRule({}, 3);
  spendPower(combat, rule, 3, 100000);
  assert.equal(combat.mana, 60);
  assert.throws(() => spendPower(combat, rule, 3, 100001), {status:429});
  assert.equal(combatResources(world, 102500).mana, 70);
  assert.equal(combatResources(world, 101000).mana, 70);
  assert.equal(combatResources(world, 110000).mana, 100);
  combat.mana = 5;
  const before = structuredClone(combat);
  assert.throws(() => spendPower(combat, rule, 3, 130000), {status:400});
  assert.deepEqual(combat, before);
});

test('support casts cannot be used for enemy damage and mana persists through re-entry', () => {
  let now = 100000;
  let profile = { characters: { characters: [{id:'pet',traits:{element:'agua'},level:1,baseStats:{atk:8,ability:8},upgrades:[]}] } };
  let routes;
  const restart = () => {
    routes = new Map();
    mountFoodieWorld({post:(path,...handlers)=>routes.set(path,handlers.at(-1))}, {
      auth:()=>{},clock:()=>now,getProfile:()=>structuredClone(profile),saveProfile:(_id,next)=>{profile=structuredClone(next);},
    });
  };
  function call(path,body){let status=200,data;routes.get('/api/world/'+path)({phone:'qa',body:attackPosition(body)},{status(code){status=code;return this;},json(value){data=value;return this;}});return {status,data};}
  restart();
  let session=call('start',{characterId:'pet'}).data.session;
  assert.equal(call('action',{session,action:'attack',slot:0,enemy:'aldea:0',kind:'wolf'}).status,400);
  assert.equal(call('action',{session,action:'cast',slot:3}).status,400);
  assert.equal(call('action',{session,action:'cast',slot:0}).status,200);
  assert.equal(call('action',{session,action:'cast',slot:1}).status,200);
  assert.equal(call('action',{session,action:'cast',slot:2}).status,200);
  assert.equal(profile.world.combat.mana,20);
  assert.equal(call('action',{session,action:'attack',slot:3,enemy:'aldea:0',kind:'wolf'}).status,400);
  assert.equal(profile.world.kills,0);
  restart();
  session=call('start',{characterId:'pet'}).data.session;
  assert.equal(profile.world.combat.mana,20);
  assert.equal(call('action',{session,action:'cast',slot:0}).status,429);
  assert.equal(call('action',{session,action:'consume',item:'mana'}).status,200);
  assert.equal(profile.world.combat.mana,80);
  now+=5000;
  assert.equal(call('action',{session,action:'cast',slot:0}).status,200);
  assert.equal(profile.world.combat.mana,70);
});


test('a first offensive spell initializes and spends mana without a prior support cast', () => {
  let profile={characters:{characters:[{id:'pet',level:1,baseStats:{atk:8,ability:8},upgrades:[]}]}};
  const routes=new Map();
  mountFoodieWorld({post:(path,...handlers)=>routes.set(path,handlers.at(-1))},{auth:()=>{},clock:()=>100000,getProfile:()=>JSON.parse(JSON.stringify(profile)),saveProfile:(_id,next)=>{profile=JSON.parse(JSON.stringify(next));}});
  let session;
  const response={status(){return this;},json(data){if(data.session)session=data.session;return this;}};
  routes.get('/api/world/start')({phone:'qa',body:{characterId:'pet'}},response);
  assert.equal(profile.world.combat.mana,100);
  routes.get('/api/world/action')({phone:'qa',body:attackPosition({session,action:'attack',slot:3,enemy:'aldea:0',kind:'wolf'})},response);
  assert.equal(profile.world.combat.mana,60);
  assert.equal(profile.world.kills,1);
});
