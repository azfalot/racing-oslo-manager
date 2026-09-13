/**
 * Championship Simulator — 1,000-iteration Monte Carlo Season Simulator
 *
 * Models end-of-season outcomes for all 10 league clubs in Comunio.
 * Evaluates decisions based on Delta Championship Probability:
 *
 *   Δ P(Championship) = P(Racing 1º | operation) - P(Racing 1º | current)
 */

import fs from 'fs';
import path from 'path';

/**
 * Standard Normal Box-Muller transform for Monte Carlo sampling.
 */
function randomNormal(mean = 0, stdDev = 1) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Default team baselines calibrated from live squad audits and historical scoring.
 */
const DEFAULT_CLUB_BASELINES = [
  { id: 21163674, name: 'Fermín Gadura F.C.', currentPoints: 245, meanPpm: 52.5, stdDev: 12.0, squadValue: 62000000 },
  { id: 21163822, name: 'Racing de Oslo', currentPoints: 188, meanPpm: 48.5, stdDev: 10.5, squadValue: 55890000 },
  { id: 21163646, name: 'M4 TEAM', currentPoints: 170, meanPpm: 42.0, stdDev: 9.5, squadValue: 38000000 },
  { id: 21163653, name: 'Pachangueros F.C.', currentPoints: 167, meanPpm: 41.5, stdDev: 9.0, squadValue: 35000000 },
  { id: 21163650, name: 'Amigos de NIN', currentPoints: 166, meanPpm: 40.0, stdDev: 9.0, squadValue: 32000000 },
  { id: 21163825, name: 'Hache FC', currentPoints: 140, meanPpm: 38.0, stdDev: 8.5, squadValue: 28000000 },
  { id: 21163563, name: 'Puente Avios FC', currentPoints: 139, meanPpm: 39.0, stdDev: 9.0, squadValue: 29000000 },
  { id: 21163583, name: 'Ana', currentPoints: 138, meanPpm: 37.0, stdDev: 8.0, squadValue: 26000000 },
  { id: 21163606, name: 'Suances nin', currentPoints: 129, meanPpm: 35.0, stdDev: 8.0, squadValue: 24000000 },
  { id: 21163612, name: 'Melano Plabloroza', currentPoints: 128, meanPpm: 34.0, stdDev: 8.0, squadValue: 22000000 }
];

/**
 * Loads the latest live standings and rivals audit data if available.
 */
export function loadLiveClubBaselines(racingCustomMean = null) {
  let clubs = [...DEFAULT_CLUB_BASELINES];

  try {
    const rivalsPath = path.resolve('web/src/data/rivalsAudit.json');
    if (fs.existsSync(rivalsPath)) {
      const rivals = JSON.parse(fs.readFileSync(rivalsPath, 'utf8'));
      if (Array.isArray(rivals) && rivals.length > 0) {
        clubs = rivals.map(r => {
          const currentPts = r.points || r.totalPoints || 150;
          const val = r.squadValue || 30000000;
          // Calibrate mean points per matchday based on squad value and current average
          const avgPts = (currentPts / 5);
          const calibratedMean = parseFloat(((avgPts * 0.7) + ((val / 1000000) * 0.8 * 0.3)).toFixed(1));
          
          return {
            id: r.id,
            name: r.teamName || r.name || 'Club',
            currentPoints: currentPts,
            meanPpm: Math.max(30, Math.min(58, calibratedMean)),
            stdDev: r.teamName?.includes('Fermín') ? 12.5 : 10.0,
            squadValue: val
          };
        });
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
 * Runs 1,000 Monte Carlo season simulations.
 *
 * Supports both signatures:
 * 1. (engine, squad, iterations, currentMatchday)
 * 2. (remainingMatchdays, customClubs, iterations)
 */
export function runChampionshipSimulation(arg0 = 33, arg1 = null, arg2 = 1000, arg3 = 4) {
  let remainingMatchdays = 33;
  let customClubs = null;
  let iterations = 1000;
  let racingMean = null;

  if (arg0 && typeof arg0.optimizeLineup === 'function') {
    // Signature 1: (engine, squad, iterations, currentMatchday)
    const engine = arg0;
    const squad = arg1;
    iterations = typeof arg2 === 'number' ? arg2 : 1000;
    const currentMatchday = typeof arg3 === 'number' ? arg3 : 4;
    remainingMatchdays = Math.max(1, 38 - currentMatchday);
    if (squad) {
      const lineup = engine.optimizeLineup(squad);
      racingMean = lineup.score || 48.5;
    }
  } else {
    // Signature 2: (remainingMatchdays, customClubs, iterations)
    remainingMatchdays = typeof arg0 === 'number' ? arg0 : 33;
    customClubs = Array.isArray(arg1) ? arg1 : null;
    iterations = typeof arg2 === 'number' ? arg2 : 1000;
  }

  const clubs = customClubs || loadLiveClubBaselines(racingMean);

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
        // Draw matchday score from Gaussian distribution
        const mdScore = Math.max(10, Math.round(randomNormal(club.meanPpm, club.stdDev)));
        simPoints += mdScore;
      }
      return {
        id: club.id,
        name: club.name,
        finalPoints: simPoints
      };
    });

    // Rank clubs by final points descending
    simResults.sort((a, b) => b.finalPoints - a.finalPoints);

    // Record rankings
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

  const racingId = 21163822;
  const racingClub = clubs.find(c => c.id === racingId || c.name?.includes('Racing')) || clubs[1];

  const tableSummary = clubs.map(c => {
    const pts = finalPointsTotals[c.id].sort((a, b) => a - b);
    const meanPts = Math.round(pts.reduce((a, b) => a + b, 0) / iterations);
    const p10 = pts[Math.floor(iterations * 0.10)];
    const p90 = pts[Math.floor(iterations * 0.90)];
    const winProb = parseFloat(((titleCounts[c.id] / iterations) * 100).toFixed(1));
    const top2Prob = parseFloat(((top2Counts[c.id] / iterations) * 100).toFixed(1));
    const top3Prob = parseFloat(((top3Counts[c.id] / iterations) * 100).toFixed(1));

    return {
      id: c.id,
      name: c.name,
      currentPoints: c.currentPoints,
      meanPpm: c.meanPpm,
      expectedFinalPoints: meanPts,
      range: `${p10} - ${p90} pts`,
      probChampion: winProb,
      probTop2: top2Prob,
      probTop3: top3Prob
    };
  }).sort((a, b) => b.expectedFinalPoints - a.expectedFinalPoints);

  const racingSummary = tableSummary.find(t => t.id === racingId || t.name?.includes('Racing')) || tableSummary[0];

  return {
    totalSimulations: iterations,
    iterations,
    remainingMatchdays,
    racing: {
      pWin: parseFloat((racingSummary.probChampion / 100).toFixed(3)),
      pTop2: parseFloat((racingSummary.probTop2 / 100).toFixed(3)),
      pTop3: parseFloat((racingSummary.probTop3 / 100).toFixed(3)),
      expectedFinalPoints: racingSummary.expectedFinalPoints,
      range: racingSummary.range
    },
    probChampion: racingSummary.probChampion,
    probTop2: racingSummary.probTop2,
    probTop3: racingSummary.probTop3,
    racingExpectedFinalPoints: racingSummary.expectedFinalPoints,
    racingRange: racingSummary.range,
    leaderName: tableSummary[0].name,
    leaderExpectedPoints: tableSummary[0].expectedFinalPoints,
    standings: tableSummary,
    table: tableSummary
  };
}

/**
 * Evaluates the Delta Championship Probability when signing candidate.
 */
export function evaluateTransferChampionshipImpact(engine, squad, candidate, iterations = 1000, currentMatchday = 4) {
  const preSim = runChampionshipSimulation(engine, squad, iterations, currentMatchday);
  const hypotheticalSquad = {
    ...squad,
    players: [...(squad?.players || []), candidate]
  };
  const postSim = runChampionshipSimulation(engine, hypotheticalSquad, iterations, currentMatchday);

  const deltaPWin = parseFloat((postSim.racing.pWin - preSim.racing.pWin).toFixed(3));
  const deltaExpectedPoints = postSim.racing.expectedFinalPoints - preSim.racing.expectedFinalPoints;

  return {
    candidateName: candidate.name,
    basePWin: preSim.racing.pWin,
    newPWin: postSim.racing.pWin,
    deltaPWin,
    baseExpectedPoints: preSim.racing.expectedFinalPoints,
    newExpectedPoints: postSim.racing.expectedFinalPoints,
    deltaExpectedPoints,
    isPositiveEV: deltaPWin > 0 || deltaExpectedPoints > 0
  };
}

/**
 * Calculates the exact Delta Championship Probability for a prospective transfer operation.
 *
 * @param {number} currentXiExpectedPoints Current XI expected points per matchday
 * @param {number} newXiExpectedPoints Hypothetical XI expected points after transfer
 * @param {number} remainingMatchdays Remaining matchdays
 */
export function evaluateChampionshipDelta(currentXiExpectedPoints, newXiExpectedPoints, remainingMatchdays = 33) {
  const preSim = runChampionshipSimulation(remainingMatchdays, loadLiveClubBaselines(currentXiExpectedPoints));
  const postSim = runChampionshipSimulation(remainingMatchdays, loadLiveClubBaselines(newXiExpectedPoints));

  const deltaProbChampion = parseFloat((postSim.probChampion - preSim.probChampion).toFixed(2));
  const deltaExpectedPoints = postSim.racingExpectedFinalPoints - preSim.racingExpectedFinalPoints;

  return {
    preProbChampion: preSim.probChampion,
    postProbChampion: postSim.probChampion,
    deltaProbChampion,
    preExpectedPoints: preSim.racingExpectedFinalPoints,
    postExpectedPoints: postSim.racingExpectedFinalPoints,
    deltaExpectedPoints,
    isPositiveEV: deltaProbChampion > 0 || deltaExpectedPoints > 0
  };
}
