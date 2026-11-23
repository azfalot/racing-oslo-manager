import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ComunioEngine } from '../src/engine.js';
import { executeDailySpeculationBids } from '../src/dailySpeculator.js';
import { loadSpeculationLedger } from '../src/dailySpeculator.js';
import { scanSpeculationOpportunities } from '../src/speculationRadar.js';
import { calculateMaxRationalBid } from '../src/squadOptimizer.js';

test('market season points never masquerade as last-match momentum', () => {
  const engine = new ComunioEngine();
  const player = { playerId: 9001, name: 'Neutral', type: 'defender', price: 1000000, average: { points: '4' }, status: 'ACTIVE' };
  assert.equal(engine.getExpectedPoints({ ...player, points: 152, totalPoints: 152 }), engine.getExpectedPoints({ ...player, totalPoints: 152 }));
  assert.ok(engine.getExpectedPoints({ ...player, lastPoints: 10 }) > engine.getExpectedPoints(player));
});

test('contradictory averages cannot promote a player with zero season and recent points', () => {
  const engine = new ComunioEngine();
  const expected = engine.getExpectedPoints({ playerId: 55, name: 'Unproven', type: 'defender', price: 630000, totalPoints: 0,
    average: { points: '15', lastXMatchdays: { points: '0' } }, status: 'ACTIVE' });
  assert.ok(expected <= 0.5);
});

test('all purchase recommendations use exact VM even for elite upgrades and rival pressure', () => {
  const candidate = { price: 5000000, owner: { id: 1, name: 'Computer' } };
  const result = calculateMaxRationalBid(candidate, { score: 95, marginalValue: 8, performance: { ppm: 8 } }, 30000000, { avgCommunityOverbid: 20 });
  assert.equal(result.recommendedBid, candidate.price);
  assert.equal(result.marginPct, 0);
});

test('a cheap price is never advertised as zero risk or guaranteed profit', () => {
  const opportunity = scanSpeculationOpportunities([{ playerId: 55, name: 'Cheap', price: 170000, owner: { id: 1, name: 'Computer' } }]).opportunities[0];
  assert.ok(opportunity.potentialDownsideEUR > 0);
  assert.equal(opportunity.guaranteedProfit, false);
  assert.doesNotMatch(opportunity.actionLabel, /riesgo 0|riesgo cero/i);
});

test('placing a bid never records a player as already purchased', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oslo-bid-record-'));
  try {
    const ledgerPath = join(dir, 'ledger.json');
    const result = await executeDailySpeculationBids(null, { players: [] }, 2000000, { dryRun: true, ledgerPath,
      marketPlayers: [{ playerId: 33, name: 'Cheap', price: 170000, owner: { id: 1, name: 'Computer' } }] });
    assert.equal(result.executedBids.length, 1);
    assert.deepEqual(loadSpeculationLedger(ledgerPath).activeTradingPlayers, []);
    assert.equal(loadSpeculationLedger(ledgerPath).pendingPurchases[0].playerId, 33);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('speculation subtracts pending commitments, including API string prices', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oslo-capital-'));
  try {
    const result = await executeDailySpeculationBids({ getPendingBids: async () => [{ playerId: 2, price: '900000' }] }, { players: [] }, 1200000, {
      dryRun: true, safetyReserveMin: 1000000, ledgerPath: join(dir, 'ledger.json'),
      marketPlayers: [{ playerId: 3, name: 'Cheap', price: 170000, owner: { id: 1, name: 'Computer' } }]
    });
    assert.deepEqual(result.executedBids, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
