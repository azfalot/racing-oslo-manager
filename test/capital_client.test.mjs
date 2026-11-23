import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ComunioClient } from '../src/comunioClient.js';
import { readCapitalState } from '../src/capitalExecution.js';
import { isVerifiedComputerOwner } from '../src/ownership.js';

test('API market normalization never invents Computer ownership when seller is absent', async () => {
  const c = new ComunioClient(); c.isLoggedIn = true; c.communityId = 1; c.userId = 2;
  c.getPlayerDetails = async () => ({});
  const original = axios.get;
  axios.get = async () => ({ status: 200, data: { items: [{ _embedded: { player: { id: 100, name: 'Unknown seller', quotedPrice: 500000, position: 'defender' } } }] } });
  try {
    const market = await c.getMarket();
    assert.equal(market.players.length, 1);
    assert.equal(isVerifiedComputerOwner(market.players[0]), false);
  } finally { axios.get = original; }
});

test('real client purchase boundary shares commitments across client instances', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oslo-client-capital-'));
  const original = axios.post;
  const originalGet = axios.get;
  let posts = 0;
  axios.post = async () => { posts++; return { status: 200, data: { status: 'OK', response: [{ status: 'OK' }] } }; };
  try {
    const paths = { capitalStatePath: join(dir, 'state.json'), capitalLockPath: join(dir, 'lock') };
    const players = ['keeper','defender','defender','defender','midfielder','midfielder','midfielder','midfielder','striker','striker','striker'].map((type,i)=>({playerId:i+1,name:`P${i}`,type,price:2000000,average:{points:'4'}}));
    const market = [100,101].map(playerId=>({playerId,name:'Target',type:'defender',price:600000,average:{points:'4'},owner:{id:1,name:'Computer'}}));
    const context = { accountId: 1, balance: 2000000, credit: 7000000, squad: { players }, market: { players: market }, pendingBids: [] };
    const a = new ComunioClient(paths); const b = new ComunioClient(paths);
    for (const client of [a,b]) { client.userId=1;client.communityId=2;client.isLoggedIn=true;client.getPurchaseContext=async()=>context; }
    assert.equal(await a.placeBid(100,'Target',600000,{confirmedByUser:true}),true);
    assert.equal(await b.placeBid(101,'Target',600000,{confirmedByUser:true}),false);
    assert.equal(b.lastPurchaseDecision.reason,'RESERVE_OR_CREDIT');
    assert.equal(posts,1);
    assert.equal(readCapitalState(paths.capitalStatePath).reservations.length,1);
    assert.equal(await b.placeBidPlaywright('Target',600000),false);
    axios.get=async()=>({data:{items:[]}});
    assert.equal(await a.cancelBid(20,'Target',100),true);
    assert.equal(readCapitalState(paths.capitalStatePath).reservations.length,0);
    assert.equal(await b.placeBid(101,'Target',600000,{confirmedByUser:true}),true);
    assert.equal(posts,3);
  } finally { axios.post=original;axios.get=originalGet;rmSync(dir,{recursive:true,force:true}); }
});

test('HTTP 200 with a rejected sale or cancellation is never reported as success', async () => {
  const c=new ComunioClient();c.isLoggedIn=true;
  const original=axios.post;
  axios.post=async()=>({status:200,data:{status:'OK',response:[{status:'ERROR',message:'Expired'}]}});
  try {
    assert.equal(await c.acceptSaleOffer(1,2,300000,{confirmedByUser:true}),false);
    assert.equal(await c.cancelBid(1,'Expired',2),false);
  } finally {axios.post=original;}
});
