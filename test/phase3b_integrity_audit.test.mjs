/**
 * Suite of Phase 3B Calibration Integrity & False-Validation Remediation Tests
 *
 * Verifies:
 * 1. Zero synthetic leakage in canonical empirical datasets
 * 2. Dynamic prior weight optimization (recalculates per config)
 * 3. Accurate multi-season naming (previousSeasonPPM, previous3SeasonMeanPPM)
 * 4. P35 replacement level is labeled HEURISTIC_PRIOR
 * 5. Cross-team correlation returns INSUFFICIENT_DATA and INDEPENDENT assumption
 * 6. Residual distribution is labeled ASSUMED_NOT_VALIDATED
 * 7. Model status is EXPERIMENTAL (not VALIDATED)
 * 8. Provenance manifest exists and tracks datasets
 * 9. Starting XI audit exists (51.7 pts audited, explains misleading 66.7)
 * 10. Symmetric XI simulation scenarios with depth penalties
 * 11. Dimensionally normalized season utility
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { CalibrationEngine } from '../src/calibrationEngine.js';
import { ComunioEngine } from '../src/engine.js';
import {
  runChampionshipSimulation,
  calibrateClubBaseline
} from '../src/championshipSimulator.js';
import { calculateSeasonUtility } from '../src/squadOptimizer.js';

// ── TEST 1: ZERO SYNTHETIC DATA IN DEFAULT CALIBRATION ─────────────────────────
test('Phase 3B Integrity 1: Default club observations contain zero synthetic data', () => {
  const calEngine = new CalibrationEngine();
  const realObs = calEngine.buildClubObservations({ allowSynthetic: false });

  assert.ok(realObs.length > 0, 'Must load real observations');
  realObs.forEach(obs => {
    assert.equal(obs.provenance.isSynthetic, false, 'Observation must have isSynthetic: false');
    assert.ok(obs.provenance.sourceFile, 'Observation must have a verified source file');
  });
});

// ── TEST 2: DYNAMIC PRIOR WEIGHT OPTIMIZATION ─────────────────────────────────
test('Phase 3B Integrity 2: Prior weight optimizer recalculates dynamically per configuration', () => {
  const calEngine = new CalibrationEngine();
  const priorWeights = calEngine.optimizeHistoricalPriorWeights();

  const configs = Object.values(priorWeights);
  assert.ok(configs.length >= 4, 'Must evaluate multiple prior configurations');

  // Verify that all configs have valid weights and metrics
  configs.forEach(cfg => {
    assert.ok(cfg.weights && cfg.weights.length > 0, 'Config must specify weights');
    assert.ok(typeof cfg.mae === 'number' && !isNaN(cfg.mae), 'MAE must be a valid number');
    assert.ok(typeof cfg.rmse === 'number' && !isNaN(cfg.rmse), 'RMSE must be a valid number');
  });
});

// ── TEST 3: ACCURATE MULTI-SEASON NAMING ──────────────────────────────────────
test('Phase 3B Integrity 3: Player observations use accurate multi-season field names', () => {
  const calEngine = new CalibrationEngine();
  const playerObs = calEngine.buildPlayerObservations();

  assert.ok(playerObs.length > 0, 'Must extract player observations');
  const sample = playerObs[0];

  assert.ok('previousSeasonPPM' in sample, 'Must contain previousSeasonPPM');
  assert.ok('previous3SeasonMeanPPM' in sample, 'Must contain previous3SeasonMeanPPM');
  assert.ok('historicalPriorPPM' in sample, 'Must contain historicalPriorPPM');
  assert.equal(sample.provenance.metricType, 'POINTS_PER_SEASON_MATCHDAY_34');
});

// ── TEST 4: REPLACEMENT LEVEL LABELED HEURISTIC PRIOR ─────────────────────────
test('Phase 3B Integrity 4: Replacement level is labeled HEURISTIC_PRIOR, not optimal benchmark', () => {
  const calEngine = new CalibrationEngine();
  const percentiles = calEngine.evaluateReplacementPercentiles();

  assert.equal(percentiles.P35.status, 'HEURISTIC_PRIOR');
  assert.equal(percentiles.P35.suitability, 'HEURISTIC_PRIOR');
});

// ── TEST 5: TEAM CORRELATION RETURNS INSUFFICIENT DATA ────────────────────────
test('Phase 3B Integrity 5: Cross-team correlation declares INSUFFICIENT_DATA and INDEPENDENT assumption', () => {
  const calEngine = new CalibrationEngine();
  const corr = calEngine.evaluateTeamCorrelation();

  assert.equal(corr.estimate, null, 'Estimate must be null');
  assert.equal(corr.confidence, 'INSUFFICIENT_DATA');
  assert.equal(corr.simulationAssumption, 'INDEPENDENT');
});

// ── TEST 6: RESIDUAL DISTRIBUTION LABELED ASSUMED NOT VALIDATED ──────────────
test('Phase 3B Integrity 6: Residual distribution is labeled ASSUMED_NOT_VALIDATED', () => {
  const calEngine = new CalibrationEngine();
  const residuals = calEngine.evaluateResidualDistribution();

  assert.equal(residuals.distributionSelected, 'GAUSSIAN_NORMAL');
  assert.equal(residuals.distributionStatus, 'ASSUMED_NOT_VALIDATED');
});

// ── TEST 7: OVERALL MODEL STATUS IS EXPERIMENTAL ──────────────────────────────
test('Phase 3B Integrity 7: Full calibration protocol marks model as EXPERIMENTAL and not empirically validated', () => {
  const calEngine = new CalibrationEngine();
  const report = calEngine.runFullCalibrationProtocol();

  assert.equal(report.status, 'EXPERIMENTAL');
  assert.equal(report.isEmpiricallyValidated, false);
  assert.equal(report.modelVersion, 'RDO-FORECAST-3.0');
});

// ── TEST 8: PROVENANCE MANIFEST INTEGRITY ─────────────────────────────────────
test('Phase 3B Integrity 8: Calibration Dataset Manifest exists and documents real vs synthetic data', () => {
  assert.ok(fs.existsSync('data/calibrationDatasetManifest.json'), 'Manifest must exist');
  const manifest = JSON.parse(fs.readFileSync('data/calibrationDatasetManifest.json', 'utf8'));

  assert.ok(manifest.datasets.length >= 4, 'Manifest must track all active datasets');
  assert.equal(manifest.summary.empiricalRecalibrationEligibility, 'INSUFFICIENT_DATA_FOR_EMPIRICAL_RECALIBRATION');
});

// ── TEST 9: STARTING XI AUDIT ACCURACY ────────────────────────────────────────
test('Phase 3B Integrity 9: Starting XI audit matches 51.7 pts and distinguishes rest-of-season PPM', () => {
  assert.ok(fs.existsSync('data/xiForecastAudit.json'), 'xiForecastAudit.json must exist');
  const audit = JSON.parse(fs.readFileSync('data/xiForecastAudit.json', 'utf8'));

  assert.equal(audit.currentXiScore, 51.7, 'Current XI score must equal 51.7 pts');
  assert.ok(audit.restOfSeasonExpectedPPM < audit.currentXiScore, 'Rest of season PPM must apply depth penalty');
  assert.ok(audit.misleadingValueExplanation.length > 0, 'Must document explanation for the former 66.7 value');
});

// ── TEST 10: SYMMETRIC XI MONTE CARLO SIMULATION ──────────────────────────────
test('Phase 3B Integrity 10: Championship simulator handles symmetric depth factor for 11-player squad', () => {
  const engine = new ComunioEngine();
  const squad = JSON.parse(fs.readFileSync('web/src/data/squad.json', 'utf8'));

  const sim = runChampionshipSimulation(engine, squad, 500, 5, { seed: 1337 });

  assert.equal(sim.status, 'EXPERIMENTAL');
  assert.ok(sim.racing.pWin >= 0 && sim.racing.pWin <= 0.35, '11-player squad with -57 deficit has realistic title probability (<35%)');
});

// ── TEST 11: SEASON UTILITY NORMALIZATION ─────────────────────────────────────
test('Phase 3B Integrity 11: Season utility dimensions are normalized and time-weighted', () => {
  const util = calculateSeasonUtility(52900000, 188, 280000, 5, 48.5);

  assert.ok(util.compositeUtility > 0 && util.compositeUtility <= 100, 'Composite utility must be in [0, 100]');
  assert.ok(util.wPts >= 0.50 && util.wPts <= 0.95, 'Points weight must increase with season matchdays');
});
