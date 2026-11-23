import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransferPlan } from '../src/transferPlan.js';

const p = (id, type, price = 500000) => ({ playerId: id, name: `P${id}`, type, price, status: 'ACTIVE', average: { points: '4,5' } });
const target = { ...p(3409, 'striker', 22640000), owner: { id: 1, name: 'Computer' } };
const squad = { players: [p(1, 'keeper'), ...[2,3,4,5].map(id => p(id, 'defender')), ...[6,7,8,9].map(id => p(id, 'midfielder')), p(10, 'striker'), p(11, 'striker', 32000000)] };
const input = { squad, market: { players: [target] }, balance: 1000000, credit: 9000000 };

test('planned sales do not become spendable cash or permit a current bid', () => {
  const plan = buildTransferPlan(input);
  assert.equal(plan.availableCash, 1000000);
  assert.equal(plan.canBidNow, false);
  assert.equal(plan.scenarios[0].feasible, true);
  assert.ok(plan.scenarios[0].plan.sales.some(p => p.playerId === 11));
});

test('every feasible scenario funds replacements, reserve and a legal formation', () => {
  for (const scenario of buildTransferPlan(input).scenarios.filter(s => s.feasible)) {
    const plan = scenario.plan;
    assert.ok(plan.cashAfterSigning >= plan.replacementBudget + 500000);
    assert.ok(plan.retained.length + 1 + plan.replacements >= 13);
    assert.ok(Object.values(plan.missingPositions).reduce((a,b) => a+b,0) <= plan.replacements);
    assert.ok(plan.spare >= 0);
  }
});

test('subtracts other pending commitments once and does not double-count Yamal bid', () => {
  const plan = buildTransferPlan({ ...input, pendingBids: [{ playerId: 3409, price: '30000000' }, { playerId: 100, price: '750000' }] });
  assert.equal(plan.availableCash, 250000);
  assert.equal(plan.committed, 750000);
});

test('rejects impossible price even when every player is sold', () => {
  assert.equal(buildTransferPlan({ ...input, prices: [50000000] }).scenarios[0].feasible, false);
});

test('missing target or already owned target never recommends liquidation', () => {
  assert.equal(buildTransferPlan({ ...input, market: { players: [] } }).scenarios[0].feasible, false);
  assert.equal(buildTransferPlan({ ...input, squad: { players: [...squad.players, target] } }).owned, true);
  assert.equal(buildTransferPlan({ ...input, squad: { players: [...squad.players, target] } }).scenarios[0].plan, null);
});

test('cheap radar excludes our players and flags rival offers without promising minutes', () => {
  const cheap = { ...p(40, 'defender', 800000), owner: { id: 8, name: 'Rival' }, average: { points: '4,57', lastXMatchdays: { points: '4' } } };
  const plan = buildTransferPlan({ ...input, market: { players: [target, cheap, squad.players[0], p(41, 'defender', 1000000), { ...p(42,'keeper'), status:'INJURED' }] } });
  assert.equal(plan.cheapCandidates.length, 1);
  assert.equal(plan.cheapCandidates[0].computer, false);
  assert.equal(plan.cheapCandidates[0].average, 4.57);
});

test('rejects unreadable finances, invalid prices and duplicate players', () => {
  for (const override of [{ balance: NaN }, { credit: undefined }, { prices: [-1] }, { replacementPrice: 1000000 }, { squad: { players: [p(1,'keeper'),p(1,'keeper')] } }]) {
    assert.throws(() => buildTransferPlan({ ...input, ...override }), /inválid/);
  }
});

test('funds the actual target position and rejects unknown positions', () => {
  const plan = buildTransferPlan({ ...input, market: { players: [{ ...target, type: 'keeper' }] } });
  for (const s of plan.scenarios.filter(s => s.feasible)) {
    assert.equal(s.plan.missingPositions.keeper, 0);
  }
  assert.throws(() => buildTransferPlan({ ...input, market: { players: [{ ...target, type: 'unknown' }] } }), /inválidos/);
});
