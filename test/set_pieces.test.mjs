import test from 'node:test';
import assert from 'node:assert/strict';
import { ComunioEngine } from '../src/engine.js';
import { evaluateSetPieceSpecialist, LALIGA_SET_PIECES_DATA } from '../src/setPieces.js';
import { getExpectedPerformance, calculateStrategicPurchaseScore } from '../src/squadOptimizer.js';

function createMockPlayer(id, name, type, price, club = 'Unknown', avgPts = '5.0') {
  return {
    id,
    playerId: id,
    name,
    type,
    position: type,
    price,
    quotedPrice: price,
    club: { name: club },
    clubName: club,
    teamName: club,
    status: 'ACTIVE',
    average: { points: avgPts },
    historical: [{ season: '23/24', points: '140' }]
  };
}

// ── TEST SUITE: SET PIECES & PENALTY SPECIALISTS ──────────────────────────────

test('1. Set-Pieces: Gerard Moreno is identified as #1 penalty taker for Villarreal with bonus', () => {
  const gerard = createMockPlayer(1927, 'Gerard Moreno', 'striker', 8950000, 'Villarreal');
  const sp = evaluateSetPieceSpecialist(gerard);

  assert.equal(sp.isPrimaryPenalty, true, 'Gerard Moreno must be primary penalty taker');
  assert.ok(sp.bonusPpm >= 0.45, 'Primary penalty taker must receive >= +0.45 PPM bonus');
  assert.ok(sp.roleLabel.includes('1º Tirador Penaltis'));
});

test('2. Set-Pieces: Denis Suárez receives set-piece specialist bonus for Alavés', () => {
  const denis = createMockPlayer(1876, 'Denis Suarez', 'midfielder', 1400000, 'Alaves');
  const sp = evaluateSetPieceSpecialist(denis);

  assert.ok(sp.isSecondaryPenalty || sp.isFreeKick || sp.isCorner, 'Denis Suarez must be recognized as set piece contributor');
  assert.ok(sp.bonusPpm >= 0.20, 'Denis Suarez must receive >= +0.20 PPM bonus');
});

test('3. Engine: getExpectedPoints awards bonus to set-piece specialists', () => {
  const engine = new ComunioEngine();

  const normalStriker = createMockPlayer(501, 'Regular Forward', 'striker', 8000000, 'Villarreal', '4.5');
  const penaltyStriker = createMockPlayer(1927, 'Gerard Moreno', 'striker', 8000000, 'Villarreal', '4.5');

  const expNormal = engine.getExpectedPoints(normalStriker);
  const expPenalty = engine.getExpectedPoints(penaltyStriker);

  assert.ok(expPenalty > expNormal, `Penalty taker points (${expPenalty}) must exceed normal player (${expNormal})`);
});

test('4. Squad Optimizer: getExpectedPerformance attaches setPiece metadata', () => {
  const valverde = createMockPlayer(101, 'Federico Valverde', 'midfielder', 16000000, 'Real Madrid');
  const perf = getExpectedPerformance(valverde);

  assert.ok(perf.setPiece, 'setPiece object must be present in getExpectedPerformance');
  assert.equal(perf.setPiece.isFreeKick, true, 'Fede Valverde is registered for direct long free-kicks');
  assert.ok(perf.setPiece.bonusPpm > 0, 'Valverde receives free-kick PPM bonus');
});
