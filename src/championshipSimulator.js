/**
 * Championship Simulator — Calibrated Monte Carlo Season Simulator
 *
 * Models end-of-season outcomes for all 10 league clubs in Comunio.
 * Features:
 * - Deterministic PRNG (Mulberry32) for reproducible simulations
 * - Common Random Numbers (CRN) for noise-free Delta Championship evaluations
 * - Symmetric rival and Racing scoring models (no asymmetric lineup-vs-aggregate comparisons)
 * - Dynamic matchday resolution via matchdayResolver
 * - Configurable simulation tiers: FAST (1k), STANDARD (10k), DECISION (50k)
 * - 95% Wilson score confidence intervals for title probabilities
 * - Strict scenario gates: ACTUAL_BASELINE, EXPECTED_AVAILABLE_XI, FULL_STRENGTH_XI
 */

import fs from 'fs';
import path from 'path';
import { resolveCurrentMatchday } from './matchdayResolver.js';

/**
 * Mulberry32 seeded Pseudo-Random Number Generator.
 * @param {number} seed 32-bit unsigned integer seed
 * @returns {() => number} Returns a pseudo-random float in [0, 1)
 */
export function createMulberry32(seed = 1337) {
  let a = (seed >>> 0) || 1337;
  return function() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard Normal Box-Muller transform using a specified PRNG function.
 * @param {number} mean Distribution mean
 * @param {number} stdDev Distribution standard deviation
 * @param {Function} rng Pseudo-random float generator returning [0, 1)
 * @returns {number} Sampled normal value
 */
export function sampleGaussian(mean = 0, stdDev = 1, rng = createMulberry32(1337)) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Computes 95% Wilson score confidence interval for a proportion p = wins / n.
 * @param {number} successes Number of title wins
 * @param {number} totalTrials Total simulation trials
 * @returns {{ lower: number, upper: number, p: number }}
 */
export function calculateWilsonConfidenceInterval(successes, totalTrials, z = 1.96) {
  if (totalTrials <= 0) return { lower: 0, upper: 0, p: 0 };
  const p = successes / totalTrials;
  const z2 = z * z;
  const denominator = 1 + z2 / totalTrials;
  const center = (p + z2 / (2 * totalTrials)) / denominator;
  const spread = (z * Math.sqrt((p * (1 - p)) / totalTrials + z2 / (4 * totalTrials * totalTrials))) / denominator;

  return {
    p: parseFloat(p.toFixed(4)),
    lower: parseFloat(Math.max(0, center - spread).toFixed(4)),
    upper: parseFloat(Math.min(1, center + spread).toFixed(4))
  };
}

/**
 * Default team baselines calibrated from live squad audits and historical scoring.
 */
export const DEFAULT_CLUB_BASELINES = [
  { id: 21163674, name: 'Fermín Gadura F.C.', currentPoints: 245, meanPpm: 52.5, stdDev: 12.0, squadValue: 62000000, playerCount: 15, injuredStarters: 0 },
  { id: 21163822, name: 'Racing de Oslo', currentPoints: 188, meanPpm: 48.5, stdDev: 10.5, squadValue: 55890000, playerCount: 11, injuredStarters: 0 },
  { id: 21163646, name: 'M4 TEAM', currentPoints: 170, meanPpm: 42.0, stdDev: 9.5, squadValue: 38000000, playerCount: 14, injuredStarters: 1 },
  { id: 21163653, name: 'Pachangueros F.C.', currentPoints: 167, meanPpm: 41.5, stdDev: 9.0, squadValue: 35000000, playerCount: 13, injuredStarters: 0 },
  { id: 21163650, name: 'Amigos de NIN', currentPoints: 166, meanPpm: 40.0, stdDev: 9.0, squadValue: 32000000, playerCount: 12, injuredStarters: 1 },
  { id: 21163825, name: 'Hache FC', currentPoints: 140, meanPpm: 38.0, stdDev: 8.5, squadValue: 28000000, playerCount: 11, injuredStarters: 0 },
  { id: 21163563, name: 'Puente Avios FC', currentPoints: 139, meanPpm: 39.0, stdDev: 9.0, squadValue: 29000000, playerCount: 12, injuredStarters: 1 },
  { id: 21163583, name: 'Ana', currentPoints: 138, meanPpm: 37.0, stdDev: 8.0, squadValue: 26000000, playerCount: 11, injuredStarters: 0 },
  { id: 21163606, name: 'Suances nin', currentPoints: 129, meanPpm: 35.0, stdDev: 8.0, squadValue: 24000000, playerCount: 10, injuredStarters: 2 },
  { id: 21163612, name: 'Melano Plabloroza', currentPoints: 128, meanPpm: 34.0, stdDev: 8.0, squadValue: 22000000, playerCount: 10, injuredStarters: 1 }
];

/**
 * Calibrate an explainable team PPM and standard deviation based on live audit data.
 */
export function calibrateClubBaseline(clubData, currentMatchday = 5, weights = { season: 0.65, form: 0.35, squad: 0.00 }) {
  const currentPts = clubData.points || clubData.totalPoints || clubData.currentPoints || 150;
  const val = clubData.squadValue || 30000000;
  const playerCount = clubData.playerCount || (clubData.players ? clubData.players.length : 12);
  const injuredStarters = clubData.injuredStarters || 0;

  // 1. Component PPMs
  const mdDivisor = Math.max(1, currentMatchday);
  const seasonPpm = currentPts / mdDivisor;
  const currentFormPpm = typeof clubData.lastMatchdayPoints === 'number' && clubData.lastMatchdayPoints > 0
    ? (clubData.lastMatchdayPoints * 0.6 + seasonPpm * 0.4)
    : seasonPpm;
  const squadExpectedPpm = (val / 1000000) * 0.8;

  // 2. Multipliers
  const depthFactor = playerCount >= 12 ? 1.0 : (playerCount === 11 ? 0.98 : Math.max(0.70, playerCount / 11));
  const availabilityFactor = 1.0 - (injuredStarters / 11) * 0.35;

  // 3. Empirical Blended Mean PPM
  const baseForecast = (weights.season * seasonPpm + weights.form * currentFormPpm + weights.squad * squadExpectedPpm);
  const calibratedMean = parseFloat((baseForecast * depthFactor * availabilityFactor).toFixed(1));
  const meanPpm = Math.max(25.0, Math.min(60.0, calibratedMean));

  // 4. Calibrated Standard Deviation
  const baseStdDev = 8.0 + 0.1 * meanPpm * (1.0 - depthFactor);
  const stdDev = parseFloat(Math.max(6.0, Math.min(14.0, baseStdDev)).toFixed(1));

  return {
    id: clubData.id,
    name: clubData.teamName || clubData.name || 'Club',
    currentPoints: currentPts,
    meanPpm,
    stdDev,
    squadValue: val,
    playerCount,
    injuredStarters,
    calibrationFactors: {
      seasonPpm: parseFloat(seasonPpm.toFixed(1)),
      currentFormPpm: parseFloat(currentFormPpm.toFixed(1)),
      squadExpectedPpm: parseFloat(squadExpectedPpm.toFixed(1)),
      depthFactor: parseFloat(depthFactor.toFixed(2)),
      availabilityFactor: parseFloat(availabilityFactor.toFixed(2)),
      weights
    }
  };
}

/**
 * Loads the latest live standings and rivals audit data if available.
 */
export function loadLiveClubBaselines(racingCustomMean = null, currentMatchday = null) {
  const resolvedMatchday = currentMatchday || resolveCurrentMatchday();
  let clubs = DEFAULT_CLUB_BASELINES.map(c => calibrateClubBaseline(c, resolvedMatchday));

  try {
    const rivalsPath = path.resolve('web/src/data/rivalsAudit.json');
    if (fs.existsSync(rivalsPath)) {
      const rivals = JSON.parse(fs.readFileSync(rivalsPath, 'utf8'));
      if (Array.isArray(rivals) && rivals.length > 0) {
        clubs = rivals.map(r => calibrateClubBaseline(r, resolvedMatchday));
      }
    }
  } catch (e) {}

  if (racingCustomMean !== null) {
    const racingIndex = clubs.findIndex(c => c.name?.includes('Racing') || c.id === 21163822);
    if (racingIndex >= 0) {
      clubs[racingIndex].meanPpm = racingCustomMean;
    }
  }

  return clubs;
}

/**
 * Runs Monte Carlo season simulations with Common Random Numbers support.
 *
 * Simulation Tiers:
 * - FAST: 1,000 iterations (real-time UI / bot sweeps)
 * - STANDARD: 10,000 iterations (War Room & daily reports)
 * - DECISION: 50,000 iterations (critical multi-million transfers)
 */
export function runChampionshipSimulation(arg0 = 33, arg1 = null, arg2 = 1000, arg3 = null, options = {}) {
  let remainingMatchdays = 33;
  let customClubs = null;
  let iterations = 1000;
  let seed = options?.seed ?? 42;
  const scenarioType = options?.scenarioType || 'ACTUAL_BASELINE';

  const resolvedMatchday = typeof arg3 === 'number' ? arg3 : resolveCurrentMatchday();

  let racingCurrentXiScore = 51.7;

  if (arg0 && typeof arg0.optimizeLineup === 'function') {
    // Signature 1: (engine, squad, iterations, currentMatchday, options)
    const engine = arg0;
    const squad = arg1;
    iterations = typeof arg2 === 'number' ? arg2 : 1000;
    remainingMatchdays = Math.max(1, 38 - resolvedMatchday);
    if (squad) {
      const lineup = engine.optimizeLineup(squad);
      racingCurrentXiScore = typeof lineup.score === 'number' ? parseFloat(lineup.score.toFixed(1)) : 51.7;
    }
  } else {
    // Signature 2: (remainingMatchdays, customClubs, iterations, currentMatchday, options)
    remainingMatchdays = typeof arg0 === 'number' ? arg0 : Math.max(1, 38 - resolvedMatchday);
    customClubs = Array.isArray(arg1) ? arg1 : null;
    iterations = typeof arg2 === 'number' ? arg2 : 1000;
  }

  // Symmetric input gate: EXPECTED_AVAILABLE_XI & FULL_STRENGTH_XI require comparable XI scores for all clubs
  if (scenarioType === 'EXPECTED_AVAILABLE_XI' || scenarioType === 'FULL_STRENGTH_XI') {
    const hasAllClubsXiData = options?.allClubsXiData === true || (Array.isArray(customClubs) && customClubs.every(c => typeof c.xiExpectedScore === 'number'));
    if (!hasAllClubsXiData) {
      return {
        productionModelVersion: 'RDO-FORECAST-3.0',
        productionModelStatus: 'HEURISTIC_BASELINE',
        experimentalModelVersion: 'RDO-EXP-3.1',
        status: 'NOT_REPORTABLE_ASYMMETRIC_INPUTS',
        scenarioType,
        championshipProbability: null,
        probChampion: null,
        probTop2: null,
        probTop3: null,
        racing: {
          currentXiExpectedPoints: racingCurrentXiScore,
          restOfSeasonAggregateExpectedPpm: 48.5,
          pWin: null,
          pTop2: null,
          pTop3: null,
          status: 'NOT_REPORTABLE_ASYMMETRIC_INPUTS'
        },
        reason: 'Rival starting XI expected scores are unobserved. Comparing Racing XI against aggregate rival forecasts introduces asymmetric bias.'
      };
    }
  }

  // ACTUAL_BASELINE: Use symmetric aggregate forecasting methodology for ALL clubs (no special Racing XI override)
  const clubs = customClubs || loadLiveClubBaselines(null, resolvedMatchday);
  const racingId = 21163822;
  const racingClub = clubs.find(c => c.id === racingId || c.name?.includes('Racing')) || clubs[1];
  const racingRestOfSeasonAggregatePpm = racingClub.meanPpm || 48.5;

  const rng = createMulberry32(seed ?? 42);

  const titleCounts = {};
  const top2Counts = {};
  const top3Counts = {};
  const finalPointsTotals = {};

  clubs.forEach(c => {
    titleCounts[c.id] = 0;
    top2Counts[c.id] = 0;
    top3Counts[c.id] = 0;
    finalPointsTotals[c.id] = [];
  });

  for (let sim = 0; sim < iterations; sim++) {
    const simResults = clubs.map(club => {
      let simPoints = club.currentPoints;
      for (let md = 0; md < remainingMatchdays; md++) {
        const mdScore = Math.max(10, Math.round(sampleGaussian(club.meanPpm, club.stdDev, rng)));
        simPoints += mdScore;
      }
      return {
        id: club.id,
        name: club.name,
        finalPoints: simPoints
      };
    });

    simResults.sort((a, b) => b.finalPoints - a.finalPoints);

    if (simResults[0]) titleCounts[simResults[0].id]++;
    if (simResults[0]) top2Counts[simResults[0].id]++;
    if (simResults[1]) top2Counts[simResults[1].id]++;
    if (simResults[0]) top3Counts[simResults[0].id]++;
    if (simResults[1]) top3Counts[simResults[1].id]++;
    if (simResults[2]) top3Counts[simResults[2].id]++;

    simResults.forEach(r => {
      finalPointsTotals[r.id].push(r.finalPoints);
    });
  }

  const tableSummary = clubs.map(c => {
    const pts = finalPointsTotals[c.id].sort((a, b) => a - b);
    const meanPts = Math.round(pts.reduce((a, b) => a + b, 0) / iterations);
    const p10 = pts[Math.floor(iterations * 0.10)];
    const p90 = pts[Math.floor(iterations * 0.90)];
    const winProb = parseFloat(((titleCounts[c.id] / iterations) * 100).toFixed(1));
    const top2Prob = parseFloat(((top2Counts[c.id] / iterations) * 100).toFixed(1));
    const top3Prob = parseFloat(((top3Counts[c.id] / iterations) * 100).toFixed(1));
    const confidenceInterval = calculateWilsonConfidenceInterval(titleCounts[c.id], iterations);

    return {
      id: c.id,
      name: c.name,
      currentPoints: c.currentPoints,
      meanPpm: c.meanPpm,
      stdDev: c.stdDev,
      expectedFinalPoints: meanPts,
      range: `${p10} - ${p90} pts`,
      probChampion: winProb,
      probTop2: top2Prob,
      probTop3: top3Prob,
      wilsonCI95: {
        lowerPct: parseFloat((confidenceInterval.lower * 100).toFixed(1)),
        upperPct: parseFloat((confidenceInterval.upper * 100).toFixed(1))
      }
    };
  }).sort((a, b) => b.expectedFinalPoints - a.expectedFinalPoints);

  const racingSummary = tableSummary.find(t => t.id === racingId || t.name?.includes('Racing')) || tableSummary[0];

  return {
    productionModelVersion: 'RDO-FORECAST-3.0',
    productionModelStatus: 'HEURISTIC_BASELINE',
    experimentalModelVersion: 'RDO-EXP-3.1',
    status: 'PRODUCTION_BASELINE',
    modelVersion: 'RDO-FORECAST-3.0',
    scenarioType,
    totalSimulations: iterations,
    iterations,
    remainingMatchdays,
    seed,
    racing: {
      currentXiExpectedPoints: racingCurrentXiScore,
      restOfSeasonAggregateExpectedPpm: racingRestOfSeasonAggregatePpm,
      pWin: parseFloat((racingSummary.probChampion / 100).toFixed(3)),
      pTop2: parseFloat((racingSummary.probTop2 / 100).toFixed(3)),
      pTop3: parseFloat((racingSummary.probTop3 / 100).toFixed(3)),
      expectedFinalPoints: racingSummary.expectedFinalPoints,
      range: racingSummary.range,
      wilsonCI95: racingSummary.wilsonCI95
    },
    probChampion: racingSummary.probChampion,
    probTop2: racingSummary.probTop2,
    probTop3: racingSummary.probTop3,
    racingExpectedFinalPoints: racingSummary.expectedFinalPoints,
    racingRange: racingSummary.range,
    racingWilsonCI95: racingSummary.wilsonCI95,
    leaderName: tableSummary[0].name,
    leaderExpectedPoints: tableSummary[0].expectedFinalPoints,
    standings: tableSummary,
    table: tableSummary
  };
}

/**
 * Evaluates the Delta Championship Probability when signing candidate using Common Random Numbers (CRN).
 * Using identical RNG seeds ensures that variance in rival outcomes cancels out.
 */
export function evaluateTransferChampionshipImpact(engine, squad, candidate, iterations = 1000, currentMatchday = null, seed = 1337) {
  const resolvedMatchday = currentMatchday || resolveCurrentMatchday();

  const preSim = runChampionshipSimulation(engine, squad, iterations, resolvedMatchday, { seed });
  
  const hypotheticalSquad = {
    ...squad,
    players: [...(squad?.players || []), candidate]
  };
  const postSim = runChampionshipSimulation(engine, hypotheticalSquad, iterations, resolvedMatchday, { seed });

  const prePWin = preSim.racing?.pWin ?? 0;
  const postPWin = postSim.racing?.pWin ?? 0;
  const deltaPWin = parseFloat((postPWin - prePWin).toFixed(3));
  const deltaExpectedPoints = (postSim.racing?.expectedFinalPoints ?? 0) - (preSim.racing?.expectedFinalPoints ?? 0);

  return {
    candidateName: candidate.name,
    basePWin: prePWin,
    newPWin: postPWin,
    deltaPWin,
    baseExpectedPoints: preSim.racing?.expectedFinalPoints ?? 0,
    newExpectedPoints: postSim.racing?.expectedFinalPoints ?? 0,
    deltaExpectedPoints,
    isPositiveEV: deltaPWin > 0 || deltaExpectedPoints > 0,
    seedUsed: seed
  };
}

/**
 * Calculates the exact Delta Championship Probability for a prospective transfer operation with CRN.
 */
export function evaluateChampionshipDelta(currentXiExpectedPoints, newXiExpectedPoints, remainingMatchdays = null, iterations = 1000, seed = 1337) {
  const resolvedRemaining = remainingMatchdays || Math.max(1, 38 - resolveCurrentMatchday());
  const preSim = runChampionshipSimulation(resolvedRemaining, loadLiveClubBaselines(currentXiExpectedPoints), iterations, null, { seed });
  const postSim = runChampionshipSimulation(resolvedRemaining, loadLiveClubBaselines(newXiExpectedPoints), iterations, null, { seed });

  const deltaProbChampion = parseFloat((postSim.probChampion - preSim.probChampion).toFixed(2));
  const deltaExpectedPoints = postSim.racingExpectedFinalPoints - preSim.racingExpectedFinalPoints;

  return {
    preProbChampion: preSim.probChampion,
    postProbChampion: postSim.probChampion,
    deltaProbChampion,
    preExpectedPoints: preSim.racingExpectedFinalPoints,
    postExpectedPoints: postSim.racingExpectedFinalPoints,
    deltaExpectedPoints,
    isPositiveEV: deltaProbChampion > 0 || deltaExpectedPoints > 0,
    seedUsed: seed
  };
}
