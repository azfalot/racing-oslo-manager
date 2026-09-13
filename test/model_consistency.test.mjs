/**
 * Suite of 14 Mathematical Model Consistency, Calibration & Validation Tests
 *
 * Validates:
 * 1. Seeded PRNG reproducibility (Mulberry32)
 * 2. Wilson 95% confidence intervals correctness
 * 3. Common Random Numbers (CRN) transfer evaluation stability
 * 4. Recency-weighted historical prior (0.50 / 0.30 / 0.20)
 * 5. Empirical-Bayes shrinkage towards prior
 * 6. Dynamic P35 replacement level baseline
 * 7. VORP confidence tiers (HIGH / MEDIUM / LOW)
 * 8. Explainable rival forecast model & depth penalties
 * 9. Dynamic matchday resolver hierarchy
 * 10. Dimensionally consistent Season Utility
 * 11. War Room integration with dynamic matchdays and optimal lineup
 * 12. Monotonicity of Championship Probability under CRN
 * 13. Non-negative standard deviation & bounded PPMs
 * 14. Backtester accuracy metrics (MAE, RMSE, Bias, ECE)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ComunioEngine } from '../src/engine.js';
import {
  createMulberry32,
  sampleGaussian,
  calculateWilsonConfidenceInterval,
  calibrateClubBaseline,
  runChampionshipSimulation,
  evaluateTransferChampionshipImpact
} from '../src/championshipSimulator.js';
import {
  calculateHistoricalPriorPPM,
  calculateRecencyWeightedPPM,
  calculateSeasonUtility
} from '../src/squadOptimizer.js';
import {
  calculateDynamicReplacementLevels,
  calculateVORP
} from '../src/vorpEngine.js';
import { resolveCurrentMatchday } from '../src/matchdayResolver.js';
import { generateWarRoomReport } from '../src/warRoom.js';
import { Backtester } from '../src/backtester.js';

// ── TEST 1: SEEDED PRNG REPRODUCIBILITY ────────────────────────────────────────
test('1. Seeded PRNG Reproducibility: Mulberry32 generates identical streams with identical seed', () => {
  const seed = 12345;
  const rng1 = createMulberry32(seed);
  const rng2 = createMulberry32(seed);

  const seq1 = Array.from({ length: 100 }, () => rng1());
  const seq2 = Array.from({ length: 100 }, () => rng2());

  assert.deepEqual(seq1, seq2, 'Identical seed must produce bit-for-bit identical pseudo-random numbers');
  
  // Test simulation reproducibility
  const sim1 = runChampionshipSimulation(30, null, 500, 8, { seed: 999 });
  const sim2 = runChampionshipSimulation(30, null, 500, 8, { seed: 999 });

  assert.equal(sim1.racing.pWin, sim2.racing.pWin, 'Monte Carlo simulations with same seed must yield identical P(Win)');
  assert.equal(sim1.racingExpectedFinalPoints, sim2.racingExpectedFinalPoints, 'Simulations with same seed must yield identical expected points');
});

// ── TEST 2: WILSON 95% CONFIDENCE INTERVALS ──────────────────────────────────
test('2. Wilson Score Confidence Interval: Bounds remain within [0, 1] and narrow with sample size', () => {
  const ci1k = calculateWilsonConfidenceInterval(24, 1000); // 2.4% with 1k trials
  const ci10k = calculateWilsonConfidenceInterval(240, 10000); // 2.4% with 10k trials

  assert.ok(ci1k.lower >= 0 && ci1k.upper <= 1, 'CI lower/upper bounds must be in [0, 1]');
  assert.ok(ci1k.lower <= ci1k.p && ci1k.p <= ci1k.upper, 'Empirical proportion must lie within CI');
  
  const width1k = ci1k.upper - ci1k.lower;
  const width10k = ci10k.upper - ci10k.lower;
  assert.ok(width10k < width1k, `10k trials CI width (${width10k}) must be narrower than 1k trials CI width (${width1k})`);
});

// ── TEST 3: COMMON RANDOM NUMBERS (CRN) TRANSFER EVALUATION ────────────────────
test('3. CRN Transfer Evaluation: Identical seed cancels out rival variance during transfer delta', () => {
  const engine = new ComunioEngine();
  const squad = {
    players: [
      { id: 1, name: 'Soria', position: 'por', price: 4000000, points: 140 },
      { id: 2, name: 'Dela', position: 'def', price: 3000000, points: 120 },
      { id: 3, name: 'Mandi', position: 'def', price: 2000000, points: 100 },
      { id: 4, name: 'Galarreta', position: 'mid', price: 4000000, points: 130 },
      { id: 5, name: 'Valverde', position: 'mid', price: 18000000, points: 220 },
      { id: 6, name: 'Gerard', position: 'del', price: 8000000, points: 160 },
      { id: 7, name: 'Duro', position: 'del', price: 5000000, points: 140 },
      { id: 8, name: 'Moi', position: 'mid', price: 2000000, points: 90 },
      { id: 9, name: 'Cardoso', position: 'mid', price: 1000000, points: 70 },
      { id: 10, name: 'Lozano', position: 'mid', price: 800000, points: 60 },
      { id: 11, name: 'Duran', position: 'del', price: 800000, points: 60 }
    ]
  };

  const eliteStar = { id: 99, name: 'Bellingham', position: 'mid', price: 20000000, points: 240, average: { points: 7.5 } };
  
  const transferImpact = evaluateTransferChampionshipImpact(engine, squad, eliteStar, 1000, 5, 777);
  
  assert.ok(transferImpact.newExpectedPoints >= transferImpact.baseExpectedPoints, 'Adding superstar must increase or equal expected points');
  assert.ok(transferImpact.deltaPWin >= 0, 'Adding superstar must produce non-negative delta P(Win)');
  assert.equal(transferImpact.seedUsed, 777, 'Must preserve seed for CRN reproducibility');
});

// ── TEST 4: RECENCY-WEIGHTED HISTORICAL PRIOR (0.50 / 0.30 / 0.20) ─────────────
test('4. Recency-Weighted Prior: Weights last 3 seasons correctly (0.50 / 0.30 / 0.20)', () => {
  const veteranPlayer = {
    name: 'Veteran Star',
    historical: [
      { season: '22/23', points: 150, gamesPlayed: 30 }, // t-3: 5.0 PPM (weight 0.20)
      { season: '23/24', points: 180, gamesPlayed: 30 }, // t-2: 6.0 PPM (weight 0.30)
      { season: '24/25', points: 210, gamesPlayed: 30 }  // t-1: 7.0 PPM (weight 0.50)
    ]
  };

  // Expected = 0.50 * 7.0 + 0.30 * 6.0 + 0.20 * 5.0 = 3.5 + 1.8 + 1.0 = 6.30
  const prior = calculateHistoricalPriorPPM(veteranPlayer);
  assert.equal(prior, 6.30, `Expected recency-weighted prior 6.30, got ${prior}`);
});

// ── TEST 5: EMPIRICAL-BAYES SHRINKAGE TOWARDS PRIOR ───────────────────────────
test('5. Empirical-Bayes Shrinkage: Small sample sizes shrink towards prior PPM', () => {
  const player = {
    name: 'Calibrated Player',
    price: 5000000,
    historical: [{ season: '24/25', points: 136, gamesPlayed: 34 }] // Prior = 4.0 PPM
  };

  // 1 game outlier score of 10 pts
  // n = 1, k = 3 -> (3 * 4.0 + 1 * 10) / 4 = 22 / 4 = 5.50
  const shrinkage1Match = calculateRecencyWeightedPPM(player, [10], 3);
  assert.equal(shrinkage1Match.posteriorPPM, 5.50, `1-game shrinkage should equal 5.50 (got ${shrinkage1Match.posteriorPPM})`);

  // 10 games with average 10 pts
  // n = 10, k = 3 -> (3 * 4.0 + 10 * 10) / 13 = 112 / 13 = 8.62
  const shrinkage10Matches = calculateRecencyWeightedPPM(player, Array(10).fill(10), 3);
  assert.equal(shrinkage10Matches.posteriorPPM, 8.62, `10-game shrinkage should equal 8.62 (got ${shrinkage10Matches.posteriorPPM})`);
  assert.ok(shrinkage10Matches.posteriorPPM > shrinkage1Match.posteriorPPM, 'Larger sample size should converge closer to sample mean');
});

// ── TEST 6: DYNAMIC REPLACEMENT LEVEL (P35) ──────────────────────────────────
test('6. Dynamic P35 Replacement Level: Calibrates baseline points by position', () => {
  const leaguePlayers = [
    { position: 'por', points: 60 }, { position: 'por', points: 100 }, { position: 'por', points: 140 },
    { position: 'def', points: 40 }, { position: 'def', points: 80 }, { position: 'def', points: 120 }, { position: 'def', points: 160 },
    { position: 'mid', points: 30 }, { position: 'mid', points: 70 }, { position: 'mid', points: 110 }, { position: 'mid', points: 150 }, { position: 'mid', points: 190 },
    { position: 'del', points: 50 }, { position: 'del', points: 90 }, { position: 'del', points: 130 }, { position: 'del', points: 170 }
  ];

  const levels = calculateDynamicReplacementLevels(leaguePlayers, 0.35);
  assert.ok(levels.por.points > 0, 'Goalkeeper replacement points must be positive');
  assert.ok(levels.def.points > 0, 'Defender replacement points must be positive');
  assert.ok(levels.mid.points > 0, 'Midfielder replacement points must be positive');
  assert.ok(levels.del.points > 0, 'Forward replacement points must be positive');
});

// ── TEST 7: VORP CONFIDENCE TIERS (HIGH / MEDIUM / LOW) ───────────────────────
test('7. VORP Confidence Tiers: Appropriately flags sample size reliability', () => {
  const engine = new ComunioEngine();
  const playerLow = { id: 1, name: 'Newbie', position: 'mid', price: 1000000, lastMatches: [3, 4] }; // n = 2 -> LOW
  const playerMed = { id: 2, name: 'Rotation', position: 'mid', price: 2000000, lastMatches: [4, 5, 3, 4, 6] }; // n = 5 -> MEDIUM
  const playerHigh = { id: 3, name: 'Starter', position: 'mid', price: 4000000, lastMatches: Array(12).fill(5) }; // n = 12 -> HIGH

  const vorpLow = calculateVORP(engine, playerLow);
  const vorpMed = calculateVORP(engine, playerMed);
  const vorpHigh = calculateVORP(engine, playerHigh);

  assert.equal(vorpLow.confidenceLevel, 'LOW', 'n=2 must yield LOW confidence');
  assert.equal(vorpMed.confidenceLevel, 'MEDIUM', 'n=5 must yield MEDIUM confidence');
  assert.equal(vorpHigh.confidenceLevel, 'HIGH', 'n=12 must yield HIGH confidence');
});

// ── TEST 8: EXPLAINABLE RIVAL FORECAST MODEL & DEPTH FACTOR ────────────────────
test('8. Explainable Rival Forecast: Incorporates season PPM, form, squad depth and availability', () => {
  const robustRival = {
    id: 101,
    name: 'Deep Squad Club',
    points: 200,
    squadValue: 50000000,
    playerCount: 16,
    injuredStarters: 0
  };

  const fragileRival = {
    id: 102,
    name: 'Fragile Club',
    points: 200,
    squadValue: 50000000,
    playerCount: 10,
    injuredStarters: 2
  };

  const calRobust = calibrateClubBaseline(robustRival, 5);
  const calFragile = calibrateClubBaseline(fragileRival, 5);

  assert.ok(calRobust.meanPpm > calFragile.meanPpm, 'Club with deep healthy squad must have higher forecast PPM than injured short squad');
  assert.ok(calRobust.calibrationFactors.depthFactor > calFragile.calibrationFactors.depthFactor, 'Depth factor must penalize short squad');
  assert.ok(calRobust.calibrationFactors.availabilityFactor > calFragile.calibrationFactors.availabilityFactor, 'Availability factor must penalize injured starters');
});

// ── TEST 9: DYNAMIC MATCHDAY RESOLVER PRECEDENCE ──────────────────────────────
test('9. Dynamic Matchday Resolver: Resolves matchday without hardcoding', () => {
  const resolved = resolveCurrentMatchday();
  const currentMd = resolved.currentMatchday;
  assert.ok(typeof currentMd === 'number' && currentMd >= 1 && currentMd <= 38, `Matchday must be an integer between 1 and 38 (got ${currentMd})`);
  assert.ok(resolved.remainingMatchdays >= 0 && resolved.remainingMatchdays <= 37, 'Remaining matchdays must be between 0 and 37');
  assert.ok(resolved.source, 'Matchday source must be documented');
});

// ── TEST 10: DIMENSIONALLY CONSISTENT SEASON UTILITY ──────────────────────────
test('10. Season Utility: Dimensions are normalized and wPts scales from 0.50 to 0.95', () => {
  const early = calculateSeasonUtility(50000000, 200, 1000000, 1, 50.0);
  const late = calculateSeasonUtility(50000000, 1700, 1000000, 38, 50.0);

  assert.ok(early.compositeUtility > 0, 'Early utility must be positive');
  assert.ok(late.compositeUtility > 0, 'Late utility must be positive');
  assert.equal(early.wPts, 0.512, 'Early points weight at MD 1 is ~0.512');
  assert.equal(late.wPts, 0.95, 'Late points weight at MD 38 is exactly 0.95');
  assert.ok(early.pointsScore <= 150, 'Points score must be scaled reasonably');
  assert.ok(early.wealthScore <= 150, 'Wealth score must be scaled reasonably');
});

// ── TEST 11: WAR ROOM INTEGRATION ─────────────────────────────────────────────
test('11. War Room Integration: Uses dynamic matchday and optimized lineup expected score', () => {
  const engine = new ComunioEngine();
  const squad = {
    players: [
      { id: 1, name: 'Soria', position: 'por', price: 4000000, points: 140 },
      { id: 2, name: 'Dela', position: 'def', price: 3000000, points: 120 },
      { id: 3, name: 'Mandi', position: 'def', price: 2000000, points: 100 },
      { id: 4, name: 'Galarreta', position: 'mid', price: 4000000, points: 130 },
      { id: 5, name: 'Valverde', position: 'mid', price: 18000000, points: 220 },
      { id: 6, name: 'Gerard', position: 'del', price: 8000000, points: 160 },
      { id: 7, name: 'Duro', position: 'del', price: 5000000, points: 140 },
      { id: 8, name: 'Moi', position: 'mid', price: 2000000, points: 90 },
      { id: 9, name: 'Cardoso', position: 'mid', price: 1000000, points: 70 },
      { id: 10, name: 'Lozano', position: 'mid', price: 800000, points: 60 },
      { id: 11, name: 'Duran', position: 'del', price: 800000, points: 60 }
    ]
  };

  const report = generateWarRoomReport(engine, squad, [], 500000, 0, null);

  assert.ok(report.data.currentMatchday >= 1, 'War Room must record dynamic currentMatchday');
  assert.ok(report.data.confidenceLevel, 'War Room must declare model confidence level');
  assert.ok(report.data.simulation.racingWilsonCI95, 'Simulation must include 95% Wilson confidence interval');
  assert.ok(report.rawText.includes('SIMULACIÓN DE CAMPEONATO'), 'War Room text must include simulation breakdown');
});

// ── TEST 12: MONOTONICITY OF TITLE PROBABILITY UNDER CRN ──────────────────────
test('12. Monotonicity of Title Probability: Higher Racing PPM yields higher or equal P(Win) under CRN', () => {
  const seed = 54321;
  const simLower = runChampionshipSimulation(30, [
    { id: 1, name: 'Rival', currentPoints: 200, meanPpm: 50.0, stdDev: 10.0 },
    { id: 21163822, name: 'Racing de Oslo', currentPoints: 190, meanPpm: 46.0, stdDev: 10.0 }
  ], 1000, 8, { seed });

  const simHigher = runChampionshipSimulation(30, [
    { id: 1, name: 'Rival', currentPoints: 200, meanPpm: 50.0, stdDev: 10.0 },
    { id: 21163822, name: 'Racing de Oslo', currentPoints: 190, meanPpm: 54.0, stdDev: 10.0 }
  ], 1000, 8, { seed });

  assert.ok(simHigher.racing.pWin >= simLower.racing.pWin, `Higher PPM must yield P(Win) >= lower PPM (${simHigher.racing.pWin} >= ${simLower.racing.pWin})`);
  assert.ok(simHigher.racingExpectedFinalPoints > simLower.racingExpectedFinalPoints, 'Higher PPM must yield higher expected final points');
});

// ── TEST 13: NON-NEGATIVE STD DEV & BOUNDED PPMS ──────────────────────────────
test('13. Bounded Parameters: Calibrated standard deviations and PPMs are within physically valid ranges', () => {
  const testClub = {
    id: 999,
    name: 'Edge Case Club',
    points: 0,
    squadValue: 0,
    playerCount: 0,
    injuredStarters: 11
  };

  const cal = calibrateClubBaseline(testClub, 1);
  assert.ok(cal.meanPpm >= 25.0, 'PPM lower bound must be >= 25.0');
  assert.ok(cal.meanPpm <= 60.0, 'PPM upper bound must be <= 60.0');
  assert.ok(cal.stdDev >= 6.0 && cal.stdDev <= 14.0, 'Standard deviation must be bounded between 6.0 and 14.0');
});

// ── TEST 14: BACKTESTER ACCURACY METRICS ──────────────────────────────────────
test('14. Backtester Metrics: Correctly computes MAE, RMSE, Bias, and ECE', () => {
  const backtester = new Backtester();
  const sampleRecords = [
    { predicted: 5.0, actual: 4.0 }, // diff = +1.0, abs = 1.0, sq = 1.0
    { predicted: 6.0, actual: 8.0 }, // diff = -2.0, abs = 2.0, sq = 4.0
    { predicted: 3.0, actual: 3.0 }, // diff =  0.0, abs = 0.0, sq = 0.0
    { predicted: 4.0, actual: 2.0 }  // diff = +2.0, abs = 2.0, sq = 4.0
  ];

  // n = 4
  // sumAbs = 1 + 2 + 0 + 2 = 5.0 -> MAE = 5 / 4 = 1.25
  // sumSq = 1 + 4 + 0 + 4 = 9.0  -> RMSE = sqrt(9 / 4) = sqrt(2.25) = 1.50
  // sumDiff = 1 - 2 + 0 + 2 = 1.0 -> Bias = 1 / 4 = +0.25
  const results = backtester.evaluateRecords(sampleRecords);

  assert.equal(results.mae, 1.25, `Expected MAE 1.25, got ${results.mae}`);
  assert.equal(results.rmse, 1.50, `Expected RMSE 1.50, got ${results.rmse}`);
  assert.equal(results.bias, 0.25, `Expected Bias +0.25, got ${results.bias}`);
  assert.ok(results.ece >= 0, 'Expected Calibration Error must be >= 0');
});
