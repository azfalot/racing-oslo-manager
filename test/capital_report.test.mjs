import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planConditionalUpgrades, recordCapitalSnapshot } from '../src/capitalReport.js';
import { DEFAULT_CAPITAL_POLICY } from '../src/capitalPolicy.js';

const players = Array.from({length:13},(_,i)=>({playerId:i+1,name:`P${i+1}`,price:1000000,power:i<11?2:0}));
const engine = { isPlayerAvailable:()=>true, optimizeLineup: squad => {
  const starting11=[...squad.players].sort((a,b)=>b.power-a.power).slice(0,11);
  return {starting11,score:starting11.reduce((sum,p)=>sum+p.power,0)};
}};
const candidate={playerId:100,name:'Upgrade',price:2000000,power:3,owner:{id:1,name:'Computer'},average:{lastXMatchdays:{points:'4'}}};
const input={squad:{players},balance:1000000,committed:0,candidates:[candidate],engine,policy:DEFAULT_CAPITAL_POLICY,
  sales:players.slice(11).map(p=>({...p,sportingAction:'REVIEW_SALE',replacementLoss:0}))};

test('conditional purchase requires sale proceeds, complete XI and positive combined gain',()=>{
  const plans=planConditionalUpgrades(input);
  assert.equal(plans.length,1);
  assert.equal(plans[0].sales.length,2);
  assert.equal(plans[0].estimatedCashAfter,1000000);
  assert.equal(plans[0].netXIUpgrade,1);
  assert.equal(plans[0].requiresConfirmedSales,true);
  assert.equal(planConditionalUpgrades({...input,committed:1000000}).length,0);
});

test('individual sale labels cannot hide the combined loss of selling starters',()=>{
  const sales=[players[0],players[12]].map(p=>({...p,sportingAction:'REVIEW_SALE',replacementLoss:0}));
  assert.deepEqual(planConditionalUpgrades({...input,sales,candidates:[{...candidate,power:2}]}),[]);
  assert.deepEqual(planConditionalUpgrades({...input,squad:{players:players.slice(0,11)},sales}),[]);
});

test('a financed auction plan must preserve a complete XI even if the bid loses',()=>{
  const sales=[players[0],players[12]].map(p=>({...p,sportingAction:'REVIEW_SALE',replacementLoss:0}));
  // Winning would add +1, but selling first removes two points if we lose.
  const plans=planConditionalUpgrades({...input,sales,candidates:[{...candidate,power:3}]});
  assert.deepEqual(plans,[]);
});

test('safe auction plans distinguish winning from losing without inventing odds',()=>{
  const plan=planConditionalUpgrades(input)[0];
  assert.equal(plan.auctionWinProbability,null);
  assert.equal(plan.xiLossIfNotAwarded,0);
  assert.equal(plan.cashIfNotAwarded,3000000);
  assert.equal(plan.cashIfAwarded,1000000);
  assert.equal(plan.purchaseConfirmed,false);
});

test('daily capital history preserves its baseline and separates accounts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'oslo-history-'));
  try{
    const file=join(dir,'history.json');
    const report={accountId:1,capturedAt:'2026-11-23T10:00:00Z',balance:1000000,committed:0,wealth:36000000,expectedXI:40,squadCount:13};
    recordCapitalSnapshot(report,file);
    const sameDay=recordCapitalSnapshot({...report,wealth:37000000},file);
    assert.equal(sameDay.snapshots.length,1);
    assert.equal(sameDay.snapshots[0].wealth,36000000);
    assert.equal(recordCapitalSnapshot({...report,capturedAt:'2026-11-24T10:00:00Z'},file).snapshots.length,2);
    assert.throws(()=>recordCapitalSnapshot({...report,accountId:2},file),/inválido/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
