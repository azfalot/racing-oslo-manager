import test from 'node:test';
import assert from 'node:assert/strict';
import { ComunioEngine } from '../src/engine.js';
import { evaluateClubMomentum, normalizeClubName, LALIGA_CLUB_MOMENTUM_DATA } from '../src/clubMomentum.js';
import { getExpectedPerformance, calculateStrategicPurchaseScore } from '../src/squadOptimizer.js';

function createMockPlayer(id, name, type, price, club = 'Unknown', avgPts = '5.0', histPts = '150') {
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
    historical: [{ season: '23/24', points: histPts }]
  };
}

function createMockSquad() {
  return {
    userId: 100,
    players: [
      createMockPlayer(1, 'David Soria', 'keeper', 4000000, 'Getafe', '4.2', '130'),
      createMockPlayer(2, 'Aissa Mandi', 'defender', 3500000, 'Villarreal', '3.8', '110'),
      createMockPlayer(3, 'Dela', 'defender', 3500000, 'Levante', '3.9', '100'),
      createMockPlayer(4, 'Jon Martin', 'defender', 4000000, 'Real Sociedad', '4.0', '120'),
      createMockPlayer(5, 'Valverde', 'midfielder', 16000000, 'Real Madrid', '5.5', '190'),
      createMockPlayer(6, 'Moi Gomez', 'midfielder', 1500000, 'Osasuna', '3.5', '90'),
      createMockPlayer(7, 'Galarreta', 'midfielder', 2000000, 'Athletic', '3.8', '100'),
      createMockPlayer(8, 'Hugo Alvarez', 'midfielder', 1200000, 'Celta', '3.6', '85'),
      createMockPlayer(9, 'Gerard Moreno', 'striker', 10000000, 'Villarreal', '4.5', '140'),
      createMockPlayer(10, 'Hugo Duro', 'striker', 4000000, 'Valencia', '3.5', '100'),
      createMockPlayer(11, 'Pablo Duran', 'striker', 800000, 'Celta', '3.0', '60')
    ]
  };
}

// ── TEST SUITE: CLUB REAL MOMENTUM & STATE OF MIND ────────────────────────────

test('1. Club Momentum: Correctly normalizes club names and assigns momentum tiers', () => {
  const villarreal = evaluateClubMomentum('Villarreal CF');
  assert.equal(villarreal.state, 'CRISIS');
  assert.equal(villarreal.momentumMultiplier, 0.82);

  const valencia = evaluateClubMomentum('Valencia C.F.');
  assert.equal(valencia.state, 'CRISIS');
  assert.equal(valencia.momentumMultiplier, 0.80);

  const barca = evaluateClubMomentum('FC Barcelona');
  assert.equal(barca.state, 'SURGING');
  assert.equal(barca.momentumMultiplier, 1.10);

  const alaves = evaluateClubMomentum('Deportivo Alaves');
  assert.equal(alaves.state, 'SURGING');
  assert.equal(alaves.momentumMultiplier, 1.06);

  const espanyol = evaluateClubMomentum('RCD Espanyol de Barcelona');
  assert.equal(espanyol.state, 'SURGING');
  assert.equal(espanyol.momentumMultiplier, 1.08);

  const madrid = evaluateClubMomentum('Real Madrid');
  assert.equal(madrid.state, 'STABLE_UEFA');
  assert.equal(madrid.momentumMultiplier, 0.95);
});

test('2. Club Momentum: Crisis clubs receive performance penalty vs surging clubs', () => {
  const crisisPlayer = createMockPlayer(201, 'Crisis Midfielder', 'midfielder', 3000000, 'Valencia', '4.0', '120');
  const surgingPlayer = createMockPlayer(202, 'Surging Midfielder', 'midfielder', 3000000, 'Alaves', '4.0', '120');

  const crisisPerf = getExpectedPerformance(crisisPlayer);
  const surgingPerf = getExpectedPerformance(surgingPlayer);

  assert.ok(surgingPerf.ppm > crisisPerf.ppm, `Surging PPM (${surgingPerf.ppm}) must be strictly greater than Crisis PPM (${crisisPerf.ppm})`);
  assert.ok(surgingPerf.expectedRemainingPoints > crisisPerf.expectedRemainingPoints, 'Expected remaining points must reflect momentum differential');
  assert.equal(crisisPerf.momentum.state, 'CRISIS');
  assert.equal(surgingPerf.momentum.state, 'SURGING');
});

test('3. Engine: getExpectedPoints integrates club momentum into matchday estimation', () => {
  const engine = new ComunioEngine();

  const villarrealStriker = createMockPlayer(301, 'Villarreal Striker', 'striker', 8000000, 'Villarreal', '4.5', '140');
  const barcaStriker = createMockPlayer(302, 'Barca Striker', 'striker', 8000000, 'Barcelona', '4.5', '140');

  const expVillarreal = engine.getExpectedPoints(villarrealStriker);
  const expBarca = engine.getExpectedPoints(barcaStriker);

  assert.ok(expBarca > expVillarreal, `Barca striker points (${expBarca}) must be strictly higher than Villarreal striker points (${expVillarreal}) due to momentum`);
});

test('4. Strategic Purchase: Recommending a target requires strictly superior momentum-adjusted PPM (DeltaXI > 0)', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();

  // Denis Suárez at Alavés (Surging form)
  const denisSuarez = createMockPlayer(1876, 'Denis Suarez', 'midfielder', 1400000, 'Alaves', '4.5', '120');
  const denisScore = calculateStrategicPurchaseScore(engine, denisSuarez, squad, 5000000);

  assert.equal(denisScore.performance.momentum.state, 'SURGING');
  assert.ok(denisScore.score > 0, 'Purchase score must be positive for a solid surging target');

  // If candidate enters XI, replaced player comparison is verified
  if (denisScore.entersXI && denisScore.replacedPlayer) {
    assert.ok(denisScore.strictlyBeatsReplaced, 'Candidate must strictly beat replaced player with momentum');
    assert.ok(denisScore.reasoning.some(r => r.includes('Supera el promedio con momentum') || r.includes('Entra en el XI titular')));
  }
});
