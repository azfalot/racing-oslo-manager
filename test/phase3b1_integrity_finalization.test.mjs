/**
 * Suite of Phase 3B.1 Calibration Integrity Finalization Tests
 *
 * Verifies:
 * 1. runFullCalibrationProtocol consumes ZERO synthetic team observations.
 * 2. buildSyntheticClubObservationsForTesting is strictly isolated for test fixtures.
 * 3. No synthetic residual statistics are emitted (sampleSize === 0, empiricalMetrics === null).
 * 4. Historical /34 metric is named seasonPointsPerLeagueRound with pointsPerAppearance: null, pointsPerStart: null.
 * 5. selectedPriorWeights is derived programmatically from candidate metrics (e.g. 60/30/10).
 * 6. selectedK is derived programmatically from candidate metrics.
 * 7. ACTUAL_BASELINE does not special-case Racing optimizeLineup score in Monte Carlo.
 * 8. EXPECTED_AVAILABLE_XI returns NOT_REPORTABLE_ASYMMETRIC_INPUTS without comparable rival XI data.
 * 9. Production model status gate is enforced (HEURISTIC_BASELINE, not unvetted experimental).
 * 10. xiForecastAudit.restOfSeasonAggregateExpectedPpm === ACTUAL_BASELINE Racing meanPpm (loadLiveClubBaselines).
 * 11. modelCalibration.playerModel.selectedK === argmin(candidateMetrics by MAE, then RMSE).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { CalibrationEngine } from '../src/calibrationEngine.js';
import { ComunioEngine } from '../src/engine.js';
import {
  runChampionshipSimulation,
  calibrateClubBaseline,
  loadLiveClubBaselines
} from '../src/championshipSimulator.js';

// ── TEST 1: ZERO SYNTHETIC TEAM OBSERVATIONS IN PRODUCTION CALIBRATION ────────
test('Phase 3B.1 Rule 1: runFullCalibrationProtocol consumes zero synthetic team observations', () => {
  const calEngine = new CalibrationEngine();
  const report = calEngine.runFullCalibrationProtocol();

  assert.equal(report.syntheticClubTargetsUsedInCalibration, 0, 'Must use 0 synthetic club targets');
  assert.equal(report.realClubMatchdayTargetsAvailable, 0, 'Real intermediate round targets must be 0');
  assert.equal(report.teamModel.status, 'INSUFFICIENT_DATA', 'Team model status must be INSUFFICIENT_DATA');
  assert.equal(report.teamModel.gridSearchBest, null, 'gridSearchBest must be null');
  assert.equal(report.teamModel.bestMAE, null, 'bestMAE must be null');
  assert.equal(report.teamModel.bestRMSE, null, 'bestRMSE must be null');
});

// ── TEST 2: SYNTHETIC FIXTURE BUILDER IS TEST-ONLY ───────────────────────────
test('Phase 3B.1 Rule 2: Synthetic fixture builder is explicitly isolated for testing', () => {
  const calEngine = new CalibrationEngine();
  assert.ok(typeof calEngine.buildSyntheticClubObservationsForTesting === 'function', 'Must expose test fixture builder');

  const testObs = calEngine.buildSyntheticClubObservationsForTesting();
  assert.ok(testObs.length > 0, 'Test fixture must produce observations');
  testObs.forEach(obs => {
    assert.equal(obs.provenance.isSynthetic, true, 'Every test fixture observation must have isSynthetic: true');
    assert.equal(obs.provenance.observationType, 'TEST_FIXTURE_ONLY');
  });
});

// ── TEST 3: NO SYNTHETIC RESIDUAL STATISTICS EMITTED ─────────────────────────
test('Phase 3B.1 Rule 3: No synthetic residual statistics are emitted without real data', () => {
  const calEngine = new CalibrationEngine();
  const residuals = calEngine.evaluateResidualDistribution();

  assert.equal(residuals.distributionSelected, 'GAUSSIAN_NORMAL');
  assert.equal(residuals.distributionStatus, 'ASSUMED_NOT_VALIDATED');
  assert.equal(residuals.sampleSize, 0, 'sampleSize must be 0');
  assert.equal(residuals.empiricalMetrics, null, 'empiricalMetrics must be null');
});

// ── TEST 4: PLAYER METRIC SEMANTICS (/34 IS NOT PLAYER PPM) ──────────────────
test('Phase 3B.1 Rule 4: /34 metric is named seasonPointsPerLeagueRound with null appearance/start data', () => {
  const calEngine = new CalibrationEngine();
  const playerObs = calEngine.buildPlayerObservations();

  assert.ok(playerObs.length > 0, 'Must extract player observations');
  const sample = playerObs[0];

  assert.ok('seasonPointsPerLeagueRound' in sample, 'Must contain seasonPointsPerLeagueRound');
  assert.equal(sample.pointsPerAppearance, null, 'pointsPerAppearance must be explicitly null');
  assert.equal(sample.pointsPerStart, null, 'pointsPerStart must be explicitly null');
  assert.equal(sample.provenance.metricType, 'SEASON_POINTS_PER_LEAGUE_ROUND_34');
});

// ── TEST 5: PROGRAMMATIC HISTORICAL PRIOR MODEL SELECTION ────────────────────
test('Phase 3B.1 Rule 5: selectedPriorWeights is derived programmatically from candidate metrics', () => {
  const calEngine = new CalibrationEngine();
  const priorResult = calEngine.optimizeHistoricalPriorWeights();

  assert.ok(priorResult.candidateMetrics, 'Must report candidateMetrics');
  assert.ok(priorResult.selectedPriorWeights, 'Must return selectedPriorWeights');

  // Verify that the winner actually has the lowest MAE among candidate configurations
  const candidateList = Object.values(priorResult.candidateMetrics);
  const minMae = Math.min(...candidateList.map(c => c.mae));
  const winningCandidate = candidateList.find(c => c.mae === minMae);

  assert.deepEqual(
    priorResult.selectedPriorWeights,
    winningCandidate.weights,
    'selectedPriorWeights must match the candidate configuration with the lowest MAE'
  );
});

// ── TEST 6: PROGRAMMATIC SHRINKAGE K SELECTION ────────────────────────────────
test('Phase 3B.1 Rule 6: selectedK is derived programmatically and labeled HEURISTIC_PRIOR', () => {
  const calEngine = new CalibrationEngine();
  const kResult = calEngine.optimizeShrinkageK();

  assert.ok(typeof kResult.selectedK === 'number', 'selectedK must be a valid number');
  assert.equal(kResult.status, 'HEURISTIC_PRIOR', 'Shrinkage K status must be HEURISTIC_PRIOR');
  assert.ok(kResult.candidateMetrics, 'Must report candidateMetrics for all K');

  const candidateList = Object.values(kResult.candidateMetrics);
  const minMae = Math.min(...candidateList.map(c => c.mae));
  const winningCandidate = candidateList.find(c => c.mae === minMae);

  assert.equal(kResult.selectedK, winningCandidate.k, 'selectedK must equal argmin(MAE)');
});

// ── TEST 7: ACTUAL_BASELINE DOES NOT SPECIAL-CASE RACING XI SCORE ────────────
test('Phase 3B.1 Rule 7: ACTUAL_BASELINE runs symmetric aggregate forecasting for all clubs', () => {
  const engine = new ComunioEngine();
  const squad = JSON.parse(fs.readFileSync('web/src/data/squad.json', 'utf8'));

  const sim = runChampionshipSimulation(engine, squad, 500, 5, { seed: 1337, scenarioType: 'ACTUAL_BASELINE' });

  assert.equal(sim.scenarioType, 'ACTUAL_BASELINE');
  assert.equal(sim.productionModelStatus, 'HEURISTIC_BASELINE');
  assert.ok('currentXiExpectedPoints' in sim.racing, 'Must expose currentXiExpectedPoints');
  assert.ok('restOfSeasonAggregateExpectedPpm' in sim.racing, 'Must expose restOfSeasonAggregateExpectedPpm');
  assert.equal(sim.racing.currentXiExpectedPoints, 51.7, 'Current XI score must be 51.7 pts');
  assert.ok(
    sim.racing.restOfSeasonAggregateExpectedPpm >= 35.0 && sim.racing.restOfSeasonAggregateExpectedPpm <= 50.0,
    `Aggregate expected PPM (${sim.racing.restOfSeasonAggregateExpectedPpm}) must be within calibrated bounds`
  );
  assert.ok(sim.racing.pWin >= 0 && sim.racing.pWin <= 0.10, 'Symmetric baseline P(Win) must be <= 10% (-57 deficit)');
});

// ── TEST 8: EXPECTED_AVAILABLE_XI REFUSES ASYMMETRIC INPUTS ───────────────────
test('Phase 3B.1 Rule 8: EXPECTED_AVAILABLE_XI refuses P(champion) without comparable rival XI data', () => {
  const engine = new ComunioEngine();
  const squad = JSON.parse(fs.readFileSync('web/src/data/squad.json', 'utf8'));

  const sim = runChampionshipSimulation(engine, squad, 500, 5, { seed: 1337, scenarioType: 'EXPECTED_AVAILABLE_XI' });

  assert.equal(sim.status, 'NOT_REPORTABLE_ASYMMETRIC_INPUTS');
  assert.equal(sim.championshipProbability, null);
  assert.equal(sim.racing.pWin, null);
});

// ── TEST 9: PRODUCTION MODEL STATUS GATE ─────────────────────────────────────
test('Phase 3B.1 Rule 9: Experimental model cannot silently replace production baseline', () => {
  const sim = runChampionshipSimulation(30, null, 100, 5, { seed: 42 });

  assert.equal(sim.productionModelVersion, 'RDO-FORECAST-3.0');
  assert.equal(sim.productionModelStatus, 'HEURISTIC_BASELINE');
  assert.equal(sim.experimentalModelVersion, 'RDO-EXP-3.1');
});

// ── TEST 10: SINGLE SOURCE OF TRUTH FOR REST-OF-SEASON AGGREGATE PPM ─────────
test('Phase 3B.1 Rule 10: xiForecastAudit.restOfSeasonAggregateExpectedPpm === ACTUAL_BASELINE Racing meanPpm', () => {
  const audit = JSON.parse(fs.readFileSync('data/xiForecastAudit.json', 'utf8'));
  const clubs = loadLiveClubBaselines();
  const racingClub = clubs.find(c => c.id === 21163822 || c.name?.includes('Racing'));

  assert.ok(racingClub, 'Racing club must exist in live baselines');
  assert.equal(
    audit.restOfSeasonAggregateExpectedPpm,
    racingClub.meanPpm,
    `Audit aggregate PPM (${audit.restOfSeasonAggregateExpectedPpm}) must strictly equal live baseline meanPpm (${racingClub.meanPpm})`
  );
});

// ── TEST 11: PROGRAMMATIC K IN CALIBRATION REPORT ─────────────────────────────
test('Phase 3B.1 Rule 11: modelCalibration.playerModel.selectedK === argmin(candidateMetrics by MAE, then RMSE)', () => {
  const calEngine = new CalibrationEngine();
  const report = calEngine.runFullCalibrationProtocol();
  const kResult = calEngine.optimizeShrinkageK();

  const candidateList = Object.values(kResult.candidateMetrics);
  const sorted = [...candidateList].sort((a, b) => a.mae - b.mae || a.rmse - b.rmse);
  const expectedK = sorted[0].k;

  assert.equal(
    report.playerModel.selectedK,
    expectedK,
    `Calibration report selectedK (${report.playerModel.selectedK}) must equal optimal candidate (${expectedK})`
  );
});
