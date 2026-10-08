import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createDatabase } from './database.js';
import { mountAdminManagement } from './admin-management.js';

test('admin login and inventory management require admin authorization', async () => {
  const db=await createDatabase(':memory:');
  db.exec('CREATE TABLE users (phone TEXT PRIMARY KEY,password_hash TEXT,created_at INTEGER)');
  db.prepare('INSERT INTO users VALUES (?,?,?)').run('qa-user','unused',0);
  const app=express();app.use(express.json());
  let profile={world:{items:[],equipped:{pet:{weapon:'explorer_blade'}},coins:0,potions:0,mana:0,kills:0}};
  const auth=(req,res,next)=>{try{req.admin=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),'test-only');if(req.admin.role!=='admin')throw Error();next();}catch{res.status(401).json({error:'Unauthorized'});}};
  mountAdminManagement(app,{db,adminAuth:auth,getProfile:phone=>phone==='qa-user'?structuredClone(profile):null,saveProfile:(_phone,p)=>{profile=p;},secret:'test-only'});
  db.prepare('INSERT INTO admin_accounts VALUES (?,?,?)').run('qa@example.com',await bcrypt.hash('qa-password-only',4),0);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,body,token,method='POST') {const r=await fetch(base+'/api/admin'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
  try {
    assert.equal((await request('/items',null,null,'GET')).status,401);
    assert.equal((await request('/login',{username:'qa@example.com',password:'wrong'})).status,401);
    for(let i=0;i<12;i++) assert.equal((await request('/login',{username:'qa@example.com',password:'wrong'})).status,401);
    const login=await request('/login',{username:'QA@example.com',password:'qa-password-only'});
    assert.equal(login.status,200);const token=login.data.token;
    assert.equal((await request('/items',null,token,'GET')).status,200);
    assert.equal((await request('/items',null,jwt.sign({role:'user'},'test-only'),'GET')).status,401);
    const path='/users/qa-user/items';
    assert.equal((await request(path,{item:'toString',action:'grant'},token)).status,400);
    await request(path,{item:'explorer_blade',action:'grant'},token);
    await request(path,{item:'explorer_blade',action:'grant'},token);
    assert.deepEqual(profile.world.items,['explorer_blade']);
    await request(path,{item:'explorer_blade',action:'remove'},token);
    assert.deepEqual(profile.world.items,[]);assert.deepEqual(profile.world.equipped.pet,{});
    assert.equal((await request('/users/qa-user/account',{password:'short'},token,'PATCH')).status,400);
    assert.equal((await request('/users/qa-user/account',{password:'replacement-test-only'},token,'PATCH')).status,200);
    assert.equal(await bcrypt.compare('replacement-test-only',db.prepare('SELECT password_hash FROM users').get().password_hash),true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM admin_audit').get().count,4);
  } finally {await new Promise(resolve=>server.close(resolve));db.close();}
});
