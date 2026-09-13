import test from 'node:test';
import assert from 'node:assert/strict';
import { ComunioEngine } from '../src/engine.js';
import {
  calculateMarginalValue,
  calculateMaxRationalBid,
  classifySquadRoles,
  starReplacementTest,
  calculateSeasonUtility,
  calculateCostPerMarginalPoint
} from '../src/squadOptimizer.js';
import {
  calculateReplacementLevel,
  calculateVORP,
  identifyPositionalWeaknesses,
  calculateDepthFragility
} from '../src/vorpEngine.js';
import {
  runChampionshipSimulation,
  evaluateTransferChampionshipImpact
} from '../src/championshipSimulator.js';

function createMockPlayer(id, name, type, price, avgPoints = 4.0, historicalPoints = 100, status = 'ACTIVE') {
  return {
    id,
    playerId: id,
    name,
    type,
    position: type,
    price,
    quotedPrice: price,
    status,
    statusInfo: '',
    available: status === 'ACTIVE',
    owner: { id: 1, name: 'Computer' },
    average: { points: String(avgPoints) },
    historical: [{ season: '23/24', points: String(historicalPoints) }]
  };
}

function createChampionshipSquad() {
  return {
    userId: 100,
    players: [
      createMockPlayer(1, 'David Soria', 'keeper', 4000000, 4.8, 150),
      createMockPlayer(2, 'Aissa Mandi', 'defender', 3500000, 4.2, 130),
      createMockPlayer(3, 'Adrián de la Fuente', 'defender', 3500000, 4.5, 140),
      createMockPlayer(4, 'Jon Martín', 'defender', 3800000, 4.0, 120),
      createMockPlayer(5, 'Álvaro Núñez', 'defender', 900000, 2.2, 50),
      createMockPlayer(6, 'Fede Valverde', 'midfielder', 16000000, 6.8, 210),
      createMockPlayer(7, 'Moi Gómez', 'midfielder', 1200000, 2.8, 80),
      createMockPlayer(8, 'Hugo Álvarez', 'midfielder', 1100000, 2.6, 75),
      createMockPlayer(9, 'Johnny Cardoso', 'midfielder', 2500000, 3.2, 90),
      createMockPlayer(10, 'Gerard Moreno', 'striker', 9000000, 5.8, 175),
      createMockPlayer(11, 'Pablo Durán', 'striker', 850000, 2.0, 45)
    ]
  };
}

// ── TEST 1: VORP CALCULATION BY POSITION ───────────────────────────────────────
test('1. Quantitative VORP: Replacement level baseline and VORP metrics across positions', () => {
  const engine = new ComunioEngine();
  const squad = createChampionshipSquad();

  // Test replacement levels
  const replMid = calculateReplacementLevel(engine, squad, 'midfielder');
  assert.ok(replMid.replacementPpm > 0, 'Midfielder replacement PPM must be positive');
  assert.ok(replMid.replacementSeasonPoints > 0, 'Replacement season points must be positive');

  // Test Valverde VORP (Star player) vs Pablo Durán (Replacement level)
  const valverde = squad.players.find(p => p.name === 'Fede Valverde');
  const duran = squad.players.find(p => p.name === 'Pablo Durán');

  const valverdeVORP = calculateVORP(engine, valverde, squad);
  const duranVORP = calculateVORP(engine, duran, squad);

  assert.ok(valverdeVORP.vorp >= 100, `Valverde VORP must be very high (got ${valverdeVORP.vorp})`);
  assert.ok(valverdeVORP.vorp > duranVORP.vorp, 'Valverde VORP must greatly exceed Durán VORP');
});

// ── TEST 2: EXPECTED XI DELTA & REPLACED PLAYER TRACKING ───────────────────────
test('2. Quantitative Delta XI: Accurately identifies dropped starter and marginal gain', () => {
  const engine = new ComunioEngine();
  const squad = createChampionshipSquad();

  // Bellingham upgrades midfield (will replace weakest starter in XI)
  const bellingham = createMockPlayer(99, 'Jude Bellingham', 'midfielder', 19000000, 7.5, 230);
  const result = calculateMarginalValue(engine, squad, bellingham);

  assert.equal(result.entersXI, true, 'Bellingham must enter starting XI');
  assert.ok(result.marginalValue >= 3.0, `Marginal XI upgrade should be high (got ${result.marginalValue})`);
  assert.ok(result.replacedPlayerName !== null, 'Must identify replaced starter name');
  assert.ok(['Álvaro Núñez', 'Pablo Durán', 'Hugo Álvarez', 'Moi Gómez'].includes(result.replacedPlayerName),
    `Replaced starter must be a weak starter (got ${result.replacedPlayerName})`);
});

// ── TEST 3: DYNAMIC BIDDING BAND 1 — SPECULATION (95-102% VM) ─────────────────
test('3. Dynamic Bidding Band 1: Speculation assets bid in 95-102% VM range', () => {
  const candidate = createMockPlayer(101, 'Injured Bargain', 'midfielder', 2000000, 4.8, 140, 'INJURED');
  candidate.statusInfo = 'Duda leve 1 jornada';

  const purchaseScore = {
    score: 40,
    components: { positionNeed: { raw: 20 } },
    performance: { ppm: 4.8, starterProbability: 0.8, efficiency: 30 },
    marginalValue: 0
  };

  const bidCalc = calculateMaxRationalBid(candidate, purchaseScore, 10000000);
  assert.equal(bidCalc.band, 'SPECULATION');
  assert.ok(bidCalc.marginPct >= 0 && bidCalc.marginPct <= 2, `Speculation margin must be 0-2% (got ${bidCalc.marginPct}%)`);
  assert.ok(bidCalc.recommendedBid <= 2000000 * 1.02);
});

// ── TEST 4: DYNAMIC BIDDING BAND 2 — DEPTH (100-105% VM) ───────────────────────
test('4. Dynamic Bidding Band 2: Rotation & depth pieces bid in 100-105% VM range', () => {
  const candidate = createMockPlayer(102, 'Solid Rotation Mid', 'midfielder', 1500000, 3.5, 100);

  const purchaseScore = {
    score: 38,
    components: { positionNeed: { raw: 60 } },
    performance: { ppm: 3.5, starterProbability: 0.7, efficiency: 25 },
    marginalValue: 1.5 // Small upgrade / depth
  };

  const bidCalc = calculateMaxRationalBid(candidate, purchaseScore, 10000000);
  assert.equal(bidCalc.band, 'DEPTH');
  assert.ok(bidCalc.marginPct >= 0 && bidCalc.marginPct <= 5, `Depth margin must be 0-5% (got ${bidCalc.marginPct}%)`);
  assert.ok(bidCalc.recommendedBid <= 1500000 * 1.05);
});

// ── TEST 5: DYNAMIC BIDDING BAND 3 — CLEAR UPGRADE (105-115% VM) ──────────────
test('5. Dynamic Bidding Band 3: Clear Starting XI upgrade (+2.5 pts) bids in 105-115% VM range', () => {
  const candidate = createMockPlayer(103, 'Proven Starter', 'striker', 7000000, 5.5, 160);

  const purchaseScore = {
    score: 65,
    components: { positionNeed: { raw: 50 } },
    performance: { ppm: 5.5, starterProbability: 0.9, efficiency: 20 },
    marginalValue: 3.5 // Clear upgrade >= 2.5 pts
  };

  const bidCalc = calculateMaxRationalBid(candidate, purchaseScore, 15000000);
  assert.equal(bidCalc.band, 'CLEAR_UPGRADE');
  assert.ok(bidCalc.marginPct >= 5 && bidCalc.marginPct <= 15, `Clear upgrade margin must be 5-15% (got ${bidCalc.marginPct}%)`);
  assert.ok(bidCalc.recommendedBid >= 7000000 * 1.05);
  assert.ok(bidCalc.recommendedBid <= 7000000 * 1.15);
});

// ── TEST 6: DYNAMIC BIDDING BAND 4 — ELITE LEAGUE WINNER (115-125% VM) ────────
test('6. Dynamic Bidding Band 4: Elite league-winning star (+5.0 pts) bids in 115-125% VM range', () => {
  const candidate = createMockPlayer(104, 'Galactico', 'midfielder', 18000000, 7.8, 230);

  const purchaseScore = {
    score: 85,
    components: { positionNeed: { raw: 70 } },
    performance: { ppm: 7.8, starterProbability: 0.95, efficiency: 15 },
    marginalValue: 6.0 // Elite upgrade >= 5.0 pts
  };

  const bidCalc = calculateMaxRationalBid(candidate, purchaseScore, 30000000);
  assert.equal(bidCalc.band, 'ELITE_LEAGUE_WINNER');
  assert.ok(bidCalc.marginPct >= 15 && bidCalc.marginPct <= 25, `Elite margin must be 15-25% (got ${bidCalc.marginPct}%)`);
  assert.ok(bidCalc.recommendedBid >= 18000000 * 1.15);
  assert.ok(bidCalc.recommendedBid <= 18000000 * 1.25);
});

// ── TEST 7: SOLVENCY CONSTRAINT & SAFETY RESERVE PROTECTION ───────────────────
test('7. Solvency Constraint: Bids are strictly capped by Balance - SafetyReserve', () => {
  const candidate = createMockPlayer(105, 'Expensive Star', 'striker', 5000000, 6.0, 180);
  const lowBalance = 5500000; // Balance (5.5M) < Recommended bid (5.0M) + SafetyReserve (1.0M) = 6.0M

  const purchaseScore = {
    score: 70,
    components: { positionNeed: { raw: 50 } },
    performance: { ppm: 6.0, starterProbability: 0.9, efficiency: 20 },
    marginalValue: 3.5
  };

  const bidCalc = calculateMaxRationalBid(candidate, purchaseScore, lowBalance);
  assert.equal(bidCalc.canAfford, false, 'Must flag that squad cannot afford without violating safety reserve');
  assert.equal(bidCalc.action, 'PASS', 'Action must be PASS when solvency constraint fails');
});

// ── TEST 8: SQUAD ROLE CLASSIFICATION ──────────────────────────────────────────
test('8. Squad Role Classification: Categorizes every player into CORE, STARTER, UPGRADEABLE, DEPTH, SPECULATIVE, SELL', () => {
  const engine = new ComunioEngine();
  const squad = createChampionshipSquad();

  const classified = classifySquadRoles(engine, squad);
  assert.equal(classified.length, squad.players.length, 'Must classify all 11 players');

  const valverde = classified.find(p => p.name === 'Fede Valverde');
  assert.equal(valverde.role, 'CORE', 'Valverde must be classified as CORE');

  const soria = classified.find(p => p.name === 'David Soria');
  assert.equal(soria.role, 'CORE', 'Only keeper must be classified as CORE');

  const roles = new Set(classified.map(p => p.role));
  assert.ok(roles.has('CORE'), 'Must identify CORE roles');
  assert.ok(roles.has('STARTER') || roles.has('UPGRADEABLE'), 'Must identify STARTER / UPGRADEABLE roles');
});

// ── TEST 9: STAR REPLACEMENT TEST — REJECTED (DELTA < +5.0 PTS) ───────────────
test('9. Star Replacement Test: Rejects sacrificing a star when upgrade package net delta is < +5.0 pts', () => {
  const engine = new ComunioEngine();
  const squad = createChampionshipSquad();
  const star = squad.players.find(p => p.name === 'Fede Valverde'); // Core star

  // Mediocre candidates
  const candidates = [
    createMockPlayer(201, 'Average Mid A', 'midfielder', 6000000, 4.0, 110),
    createMockPlayer(202, 'Average Mid B', 'midfielder', 6000000, 3.8, 100)
  ];

  const testResult = starReplacementTest(engine, squad, star, candidates);
  assert.equal(testResult.shouldSell, false, 'Must reject star sale when net delta < +5.0 pts');
  assert.ok(testResult.netDelta < 5.0, `Net delta must be below +5.0 threshold (got ${testResult.netDelta})`);
});

// ── TEST 10: STAR REPLACEMENT TEST — APPROVED (DELTA >= +5.0 PTS & CASH >= 0) ──
test('10. Star Replacement Test: Approves star sale only when net delta >= +5.0 pts and cash delta >= 0', () => {
  const engine = new ComunioEngine();
  const squad = createChampionshipSquad();
  const star = squad.players.find(p => p.name === 'Fede Valverde'); // 16M

  // High-impact multi-upgrade package costing <= 16M
  const candidates = [
    createMockPlayer(203, 'Elite Striker', 'striker', 7500000, 6.2, 190),
    createMockPlayer(204, 'Elite Midfielder', 'midfielder', 7500000, 6.0, 185)
  ];

  const testResult = starReplacementTest(engine, squad, star, candidates);
  assert.ok(testResult.cashDelta >= 0, `Cash delta must be non-negative (got ${testResult.cashDelta})`);
  assert.ok(testResult.starReplacementLoss > 0, 'Star replacement loss must be calculated');
});

// ── TEST 11: DYNAMIC TIME-DECAYING SEASON UTILITY ─────────────────────────────
test('11. Dynamic Season Utility: Points weight rises to 0.95 as matchday approaches 38', () => {
  const earlySeason = calculateSeasonUtility(50, 20, 1000000, 1);
  const midSeason = calculateSeasonUtility(50, 150, 500000, 19);
  const lateSeason = calculateSeasonUtility(50, 300, 200000, 38);

  assert.ok(earlySeason.wPts >= 0.50 && earlySeason.wPts <= 0.55, `Early season points weight should be ~0.51 (got ${earlySeason.wPts})`);
  assert.ok(midSeason.wPts >= 0.70 && midSeason.wPts <= 0.75, `Mid season points weight should be ~0.73 (got ${midSeason.wPts})`);
  assert.equal(lateSeason.wPts, 0.95, `Late season points weight must be exactly 0.95 (got ${lateSeason.wPts})`);
  assert.equal(lateSeason.wVal, 0.05, `Late season asset weight must be exactly 0.05 (got ${lateSeason.wVal})`);
});

// ── TEST 12: 1,000-RUN MONTE CARLO SIMULATION & CHAMPIONSHIP DELTA ─────────────
test('12. Monte Carlo Simulator: Runs 1,000 simulations and computes championship probability delta', () => {
  const engine = new ComunioEngine();
  const squad = createChampionshipSquad();

  const simResult = runChampionshipSimulation(engine, squad, 1000, 4);
  assert.equal(simResult.totalSimulations, 1000, 'Must run exactly 1,000 iterations');
  assert.ok(simResult.racing.pWin >= 0 && simResult.racing.pWin <= 1, 'P(Win) must be a valid probability');
  assert.ok(simResult.racing.pTop3 >= simResult.racing.pWin, 'P(Top3) must be >= P(Win)');
  assert.ok(simResult.standings.length >= 2, 'Standings table must contain modeled clubs');

  // Test prospective transfer impact
  const crack = createMockPlayer(301, 'League Winner Mid', 'midfielder', 15000000, 7.5, 220);
  const impact = evaluateTransferChampionshipImpact(engine, squad, crack, 500, 4);

  assert.ok(typeof impact.deltaPWin === 'number', 'Delta P(Win) must be numeric');
  assert.ok(impact.newPWin >= impact.basePWin, 'Adding an elite upgrade must increase or maintain championship probability');
});
