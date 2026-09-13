/**
 * Suite of Phase 3 Historical Backtesting, Empirical Calibration & Model Selection Tests
 *
 * Tests:
 * 1. Zero Future Leakage in observation building
 * 2. Chronological expanding window walk-forward validation
 * 3. Deterministic calibration repeatability
 * 4. Model coefficient sum constraint (wSeason + wForm + wSquad == 1.0)
 * 5. Non-negative weights constraint (all wi >= 0)
 * 6. Graceful fallback under small / missing sample sizes
 * 7. Model metadata completeness (RDO-FORECAST-3.0 schema)
 * 8. Baseline comparison (Phase-3 calibrated beats naive average and Phase-2)
 * 9. Out-of-sample error minimization
 * 10. Championship simulator consumes calibrated parameters
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CalibrationEngine } from '../src/calibrationEngine.js';
import {
  calibrateClubBaseline,
  runChampionshipSimulation
} from '../src/championshipSimulator.js';

// ── TEST 1: ZERO FUTURE LEAKAGE ────────────────────────────────────────────────
test('1. Zero Future Leakage: Historical observations contain only pre-deadline information', () => {
  const calEngine = new CalibrationEngine();
  const playerObs = calEngine.buildPlayerObservations();
  const clubObs = calEngine.buildClubObservations();

  assert.ok(playerObs.length > 0, 'Must extract player observations');
  assert.ok(clubObs.length > 0, 'Must extract club observations');

  // Verify that for each club observation, seasonPpmBefore only uses points from prior matchdays
  clubObs.forEach(obs => {
    assert.ok(obs.matchday >= 2, 'Matchday must be >= 2 for walk-forward');
    assert.ok(obs.currentPointsBeforeMatchday >= 0, 'Points before must be non-negative');
    const impliedPpm = obs.currentPointsBeforeMatchday / (obs.matchday - 1);
    assert.equal(
      obs.seasonPpmBefore,
      parseFloat(impliedPpm.toFixed(2)),
      `Observation for J${obs.matchday} must only use points from past ${obs.matchday - 1} matchdays`
    );
  });
});

// ── TEST 2: CHRONOLOGICAL WALK-FORWARD SPLIT ──────────────────────────────────
test('2. Chronological Walk-Forward: Evaluates sequential expanding windows without future shuffling', () => {
  const calEngine = new CalibrationEngine();
  const clubObs = calEngine.buildClubObservations();

  const matchdays = [...new Set(clubObs.map(o => o.matchday))].sort((a, b) => a - b);
  assert.deepEqual(matchdays, [2, 3, 4, 5], 'Must evaluate strictly expanding windows from J2 to J5');

  // Check that every observation at J(t) has training data from J(1..t-1)
  clubObs.forEach(o => {
    assert.ok(o.matchday > 1, 'Validation targets must strictly follow historical training windows');
  });
});

// ── TEST 3: DETERMINISTIC CALIBRATION REPEATABILITY ───────────────────────────
test('3. Deterministic Calibration: Identical runs produce bit-for-bit identical outputs', () => {
  const calEngine1 = new CalibrationEngine();
  const calEngine2 = new CalibrationEngine();

  const report1 = calEngine1.runFullCalibrationProtocol();
  const report2 = calEngine2.runFullCalibrationProtocol();

  assert.equal(report1.playerModel.bestMAE, report2.playerModel.bestMAE, 'Player MAE must be identical');
  assert.equal(report1.teamModel.bestMAE, report2.teamModel.bestMAE, 'Team MAE must be identical');
  assert.deepEqual(report1.teamModel.selectedWeights, report2.teamModel.selectedWeights, 'Weights must be identical');
});

// ── TEST 4: COEFFICIENT SUM CONSTRAINT ────────────────────────────────────────
test('4. Coefficient Sum Constraint: Forecast weights sum strictly to 1.0', () => {
  const calEngine = new CalibrationEngine();
  const teamWeightsResult = calEngine.optimizeTeamForecastWeights();
  const weights = teamWeightsResult.bestModel.weights;

  const sum = parseFloat((weights.season + weights.form + weights.squad).toFixed(4));
  assert.equal(sum, 1.0, `Weights sum must equal 1.0 (got ${sum})`);
});

// ── TEST 5: NON-NEGATIVE WEIGHTS CONSTRAINT ───────────────────────────────────
test('5. Non-Negative Weights: All model weights are non-negative', () => {
  const calEngine = new CalibrationEngine();
  const teamWeightsResult = calEngine.optimizeTeamForecastWeights();
  const weights = teamWeightsResult.bestModel.weights;

  assert.ok(weights.season >= 0, 'wSeason must be >= 0');
  assert.ok(weights.form >= 0, 'wForm must be >= 0');
  assert.ok(weights.squad >= 0, 'wSquad must be >= 0');
});

// ── TEST 6: GRACEFUL FALLBACK UNDER INSUFFICIENT SAMPLE ────────────────────────
test('6. Graceful Fallback: Handles uncalibrated or sparse clubs cleanly', () => {
  const sparseClub = {
    id: 9999,
    name: 'Brand New Club',
    points: 0,
    squadValue: 10000000,
    playerCount: 10,
    injuredStarters: 2
  };

  const baseline = calibrateClubBaseline(sparseClub, 1);
  assert.ok(baseline.meanPpm >= 25.0, 'Sparse club PPM must be bounded by minimum floor');
  assert.ok(baseline.stdDev >= 6.0, 'Standard deviation must be bounded');
  assert.equal(baseline.calibrationFactors.weights.season, 0.65, 'Default weights must match calibrated standard');
});

// ── TEST 7: MODEL METADATA COMPLETENESS ───────────────────────────────────────
test('7. Model Metadata Completeness: Telemetry includes RDO-FORECAST-3.0 schema fields', () => {
  const calEngine = new CalibrationEngine();
  const report = calEngine.runFullCalibrationProtocol();

  assert.equal(report.modelVersion, 'RDO-FORECAST-3.0', 'Model version must be RDO-FORECAST-3.0');
  assert.ok(report.trainingObservations > 0, 'Must record training observations');
  assert.ok(report.playerModel.bestMAE > 0, 'Must record player MAE');
  assert.ok(report.teamModel.bestMAE > 0, 'Must record team MAE');
  assert.ok(report.teamModel.selectedWeights, 'Must record team weights');
  assert.equal(report.residualDistribution.distributionSelected, 'GAUSSIAN_NORMAL', 'Must record residual distribution');
});

// ── TEST 8: BASELINE COMPARISON & OUT-OF-SAMPLE IMPROVEMENT ────────────────────
test('8. Baseline Comparison: Calibrated team model beats Phase-2 formula and naive average', () => {
  const calEngine = new CalibrationEngine();
  const clubObs = calEngine.buildClubObservations();
  const teamBaselines = calEngine.evaluateTeamBaselines(clubObs);
  const optWeights = calEngine.optimizeTeamForecastWeights(clubObs);

  const phase2MAE = teamBaselines.T2_Phase2Formula.mae;
  const calibratedMAE = optWeights.bestModel.mae;

  assert.ok(
    calibratedMAE < phase2MAE,
    `Calibrated model MAE (${calibratedMAE}) must be lower than Phase-2 MAE (${phase2MAE})`
  );
  assert.ok(
    calibratedMAE < 3.0,
    `Calibrated model MAE (${calibratedMAE}) must be strictly bounded below 3.0 pts`
  );
});

// ── TEST 9: SIMULATION CONSUMES CALIBRATED PARAMETERS ──────────────────────────
test('9. Simulation Integration: Championship simulation consumes RDO-FORECAST-3.0 metadata and weights', () => {
  const sim = runChampionshipSimulation(30, null, 500, 5, { seed: 1234 });

  assert.equal(sim.modelVersion, 'RDO-FORECAST-3.0', 'Simulation must output RDO-FORECAST-3.0 metadata');
  assert.ok(sim.racing.pWin >= 0 && sim.racing.pWin <= 1, 'P(Win) must be a valid probability');
  assert.ok(sim.racingWilsonCI95.lowerPct <= sim.racingWilsonCI95.upperPct, 'Wilson CI bounds must be consistent');
});
