import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDatabase } from './database.js';
import { initializeAdminAccounts } from './admin-management.js';
import { mountAdminCrud } from './admin-crud.js';

test('admin CRUD preserves consumed receipts and foreign-key integrity', async () => {
  const db=await createDatabase(':memory:');db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE users(phone TEXT PRIMARY KEY,password_hash TEXT);
    CREATE TABLE profiles(phone TEXT PRIMARY KEY REFERENCES users(phone) ON DELETE CASCADE,data TEXT);
    CREATE TABLE stores(id TEXT PRIMARY KEY);
    CREATE TABLE products(id TEXT PRIMARY KEY,store_id TEXT REFERENCES stores(id) ON DELETE CASCADE);
    CREATE TABLE invoice_codes(id INTEGER PRIMARY KEY,code TEXT UNIQUE,product_id TEXT REFERENCES products(id) ON DELETE CASCADE,status TEXT,campaign_id TEXT,metadata TEXT,redeemed_by TEXT);
    CREATE TABLE foodie_purchases(store_id TEXT REFERENCES stores(id),code TEXT REFERENCES invoice_codes(code));
    INSERT INTO users VALUES('123456','unused'); INSERT INTO stores VALUES('store'); INSERT INTO products VALUES('product','store');
    INSERT INTO invoice_codes VALUES(1,'USED','product','REDEEMED','campaign','{}','123456');
    INSERT INTO invoice_codes VALUES(2,'NEW','product','AVAILABLE','campaign','{}',NULL);
    INSERT INTO foodie_purchases VALUES('store','USED');`);
  initializeAdminAccounts(db);
  const profile={characters:{characters:[{id:'pet',name:'Original'}]},world:{coins:4}};
  db.prepare('INSERT INTO profiles VALUES (?,?)').run('123456',JSON.stringify(profile));
  const app=express();app.use(express.json());
  mountAdminCrud(app,{db,adminAuth:(req,res,next)=>{if(req.headers.authorization!=='Bearer test-admin')return res.status(401).json({error:'Unauthorized'});req.admin={username:'test'};next();},getProfile:phone=>{const row=db.prepare('SELECT data FROM profiles WHERE phone=?').get(phone);return row?JSON.parse(row.data):null;},saveProfile:(phone,p)=>db.prepare('UPDATE profiles SET data=? WHERE phone=?').run(JSON.stringify(p),phone)});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  async function request(path,body,method='PATCH',authorized=true){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/admin${path}`,{method,headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer test-admin'}:{})},...(body?{body:JSON.stringify(body)}:{})});return r.status;}
  try {
    assert.equal(await request('/users/123456',{coins:12},'PATCH',false),401);
    assert.equal(await request('/users/123456',{coins:-1}),400);
    assert.equal(await request('/users/123456',{coins:12,petNames:[{id:'pet',name:'Renamed'}]}),200);
    const updated=JSON.parse(db.prepare('SELECT data FROM profiles').get().data);assert.equal(updated.world.coins,12);assert.equal(updated.characters.characters[0].name,'Renamed');
    assert.equal(await request('/invoices/1',{campaign_id:'edit',status:'AVAILABLE',note:''}),400);
    assert.equal(await request('/invoices/2',{campaign_id:'edit',status:'CANCELLED',note:'Correction'}),200);
    assert.equal(await request('/invoices/2',null,'DELETE'),200);
    assert.equal(await request('/invoices/2',{campaign_id:'edit',status:'AVAILABLE',note:''}),404);
    assert.equal(db.prepare('SELECT status FROM invoice_codes WHERE id=2').get().status,'CANCELLED');
    assert.equal(await request('/users/123456',null,'DELETE'),200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,0);
    const consumed=db.prepare('SELECT * FROM invoice_codes WHERE id=1').get();assert.equal(consumed.status,'REDEEMED');assert.equal(consumed.redeemed_by,null);
    assert.equal(await request('/stores/store',null,'DELETE'),200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM foodie_purchases').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoice_codes').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM admin_audit').get().n,5);
  } finally {await new Promise(resolve=>server.close(resolve));db.close();}
});
