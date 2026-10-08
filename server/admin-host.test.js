import test from 'node:test';
import assert from 'node:assert/strict';
import { adminHostRouting } from './admin-host.js';

test('production separates game and administration while local /admin stays available', () => {
  const middleware=adminHostRouting({adminHost:'aodaseadmin.reinbor.cloud',publicHost:'aodase.reinbor.cloud',production:true});
  const check=(host,path)=>{const req={hostname:host,path,url:path};let status=200,next=false;middleware(req,{status:s=>{status=s;return {json:()=>{}};}},()=>{next=true;});return {status,next,url:req.url};};
  assert.deepEqual(check('aodaseadmin.reinbor.cloud','/'),{status:200,next:true,url:'/'});
  assert.equal(check('aodase.reinbor.cloud','/api/admin/users').status,404);
  assert.equal(check('unknown.example','/admin').status,404);
  assert.equal(check('aodaseadmin.reinbor.cloud','/api/profile').status,404);
  assert.equal(check('aodase.reinbor.cloud','/').next,true);
  let next=false;
  adminHostRouting({adminHost:'aodaseadmin.reinbor.cloud',publicHost:'aodase.reinbor.cloud',production:false})({hostname:'localhost',path:'/admin'},null,()=>{next=true;});
  assert.equal(next,true);
});
