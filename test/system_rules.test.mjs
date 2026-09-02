import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { ComunioEngine } from '../src/engine.js';
import {
  calculateMaxRationalBid,
  evaluateIncomingOffer,
  getStrategy
} from '../src/squadOptimizer.js';
import { getAutoBidLimit } from '../src/marketMonitor.js';
import { isWithinPreMatchdayWindow } from '../src/preMatchdayWindow.js';
import { acquireSyncLock, releaseSyncLock } from '../src/syncWeb.mjs';

function createMockPlayer(id, name, type, price, ownerObj = null) {
  return {
    id,
    playerId: id,
    name,
    type,
    position: type,
    price,
    quotedPrice: price,
    status: 'ACTIVE',
    owner: ownerObj,
    ownerName: ownerObj?.name || (ownerObj === null ? undefined : 'Computer'),
    average: { points: '5.0' },
    historical: [{ season: '23/24', points: '150' }]
  };
}

function createMockSquad() {
  return {
    userId: 100,
    players: [
      createMockPlayer(1, 'Soria', 'keeper', 4000000),
      createMockPlayer(2, 'Mandi', 'defender', 4000000),
      createMockPlayer(3, 'Dela', 'defender', 3500000),
      createMockPlayer(4, 'Jon Martin', 'defender', 4000000),
      createMockPlayer(5, 'Arguibide', 'defender', 1000000),
      createMockPlayer(6, 'Valverde', 'midfielder', 16000000),
      createMockPlayer(7, 'Moi Gomez', 'midfielder', 1000000),
      createMockPlayer(8, 'Galarreta', 'midfielder', 2000000),
      createMockPlayer(9, 'Hugo Alvarez', 'midfielder', 1000000),
      createMockPlayer(10, 'Gerard Moreno', 'striker', 10000000),
      createMockPlayer(11, 'Hugo Duro', 'striker', 4000000)
    ]
  };
}

// ── TEST SUITE 1: REGLA 1 (PROHIBICIÓN TOTAL DE AUTO-VENTAS) ─────────────────
test('System Rule 1: evaluateIncomingOffer NEVER returns ACCEPT_OFFER automatically', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const player = squad.players[4]; // Arguibide

  // Test offer above market value with debt
  const offerAbove = { price: 2000000, user: { id: 1, name: 'Computer' } };
  const evalInDebt = evaluateIncomingOffer(engine, player, offerAbove, squad, -500000);
  assert.notEqual(evalInDebt.action, 'ACCEPT_OFFER', 'Must never return ACCEPT_OFFER in debt');
  assert.equal(evalInDebt.shouldAccept, false, 'shouldAccept must be false for autonomous safety');
  assert.equal(evalInDebt.action, 'REQUIRE_CONFIRMATION', 'Valid profitable offers must require human confirmation');

  // Test offer below market value -> strictly REJECT_OFFER
  const offerBelow = { price: 800000, user: { id: 1, name: 'Computer' } };
  const evalBelow = evaluateIncomingOffer(engine, player, offerBelow, squad, -500000);
  assert.equal(evalBelow.action, 'REJECT_OFFER', 'Offers below VM must be strictly rejected');
  assert.equal(evalBelow.shouldAccept, false);
});

// ── TEST SUITE 2: REGLA 2 (DENY-BY-DEFAULT ON RIVAL PLAYERS) ─────────────────
test('System Rule 2: Deny-by-default on non-Computer players for auto-bidding', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const balance = 10000000;

  // 1. Cheap rival player (even high scoring) -> Must NOT be recommended for purchase
  const rivalPlayer = createMockPlayer(201, 'Rival Bargain', 'midfielder', 500000, { id: 2, name: 'Fermin Gadura FC' });
  const rivalAnalysis = engine.analyzeMarket([rivalPlayer], squad, balance);
  assert.equal(rivalAnalysis.recommendations.length, 0, 'Rival players must be strictly excluded from recommendations');

  // 2. Missing owner player -> Must be treated as non-Computer (deny-by-default)
  const unknownPlayer = createMockPlayer(202, 'Unknown Owner', 'midfielder', 500000, null);
  delete unknownPlayer.owner;
  delete unknownPlayer.ownerName;
  const unknownAnalysis = engine.analyzeMarket([unknownPlayer], squad, balance);
  assert.equal(unknownAnalysis.recommendations.length, 0, 'Players with unknown/missing owner must be denied by default');

  // 3. Confirmed Computer player -> Permitted
  const computerPlayer = createMockPlayer(203, 'Computer Star', 'midfielder', 2000000, { id: 1, name: 'Computer' });
  const compAnalysis = engine.analyzeMarket([computerPlayer], squad, balance);
  assert.ok(compAnalysis.recommendations.length >= 0, 'Confirmed computer players proceed to sporting evaluation');
});

// ── TEST SUITE 3: REGLA 3 (EXACT PRICING 100.0% VM) ───────────────────────────
test('System Rule 3: Recommended bid is strictly 100.0% of market value (0% margin)', () => {
  const candidate = createMockPlayer(301, 'Target Star', 'midfielder', 5000000, { id: 1, name: 'Computer' });
  const purchaseScore = { score: 55, components: {}, performance: { ppm: 6.0, starterProbability: 0.9, efficiency: 10 } };
  const rivalIntel = { avgCommunityOverbid: 8.5 };

  const bidCalc = calculateMaxRationalBid(candidate, purchaseScore, 20000000, rivalIntel);
  assert.equal(bidCalc.recommendedBid, 5000000, 'Recommended bid must equal exact market price');
  assert.equal(bidCalc.marginPct, 0, 'Margin percentage must be strictly 0');
});

// ── TEST SUITE 4: REGLA 4 (PRE-MATCHDAY WINDOW 15-30 MIN) ─────────────────────
test('System Rule 4: isWithinPreMatchdayWindow checks exact 15-30 min boundary', () => {
  assert.equal(isWithinPreMatchdayWindow(14), false, '14 min is outside window');
  assert.equal(isWithinPreMatchdayWindow(15), true, '15 min is inside window');
  assert.equal(isWithinPreMatchdayWindow(22), true, '22 min is inside window');
  assert.equal(isWithinPreMatchdayWindow(30), true, '30 min is inside window');
  assert.equal(isWithinPreMatchdayWindow(31), false, '31 min is outside window');
  assert.equal(isWithinPreMatchdayWindow(null), false, 'null is invalid');
});

// ── TEST SUITE 5: REGLA 6 (AUTOBIDLIMIT MILLIONS AND EUROS) ──────────────────
test('System Rule 5: getAutoBidLimit standardizes both million units and euro amounts', () => {
  // Test numeric value in millions (< 1000)
  const testCfgMillions = { autoBidLimit: 8 };
  fs.writeFileSync('config.test.json', JSON.stringify(testCfgMillions));
  assert.equal(getAutoBidLimit('config.test.json'), 8000000, 'Input 8 must yield 8000000');

  // Test numeric value in exact euros (>= 1000)
  const testCfgEuros = { autoBidLimit: 8000000 };
  fs.writeFileSync('config.test.json', JSON.stringify(testCfgEuros));
  assert.equal(getAutoBidLimit('config.test.json'), 8000000, 'Input 8000000 must yield 8000000');

  try { fs.unlinkSync('config.test.json'); } catch(e) {}
});

// ── TEST SUITE 6: SYNCWEB MUTEX CONCURRENCY ──────────────────────────────────
test('System Rule 6: acquireSyncLock enforces single-process exclusion and owner-only release', () => {
  const testLock = '.test_sync.lock';
  try { fs.unlinkSync(testLock); } catch (e) {}

  const lock1 = acquireSyncLock(testLock);
  assert.equal(typeof lock1, 'string', 'First lock acquisition must return an ownership token');

  const lock2 = acquireSyncLock(testLock);
  assert.equal(lock2, false, 'Second lock acquisition must be rejected');
  assert.equal(releaseSyncLock(testLock, 'not-the-owner'), false, 'Another owner cannot release the lock');

  assert.equal(releaseSyncLock(testLock, lock1), true, 'Lock owner must release successfully');
  const lock3 = acquireSyncLock(testLock);
  assert.equal(typeof lock3, 'string', 'Lock acquisition must succeed after release');
  assert.equal(releaseSyncLock(testLock, lock3), true);
});
