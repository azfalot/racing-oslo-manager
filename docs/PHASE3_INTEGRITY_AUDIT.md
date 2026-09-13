# 🛡️ PHASE 3B — CALIBRATION INTEGRITY AUDIT & FALSE-VALIDATION REMEDIATION REPORT

**Repository:** `azfalot/racing-oslo-manager`  
**Audit Date:** 2026-09-13  
**Auditor:** Quantitative Integrity & Validation System  
**Model Version:** `RDO-FORECAST-3.0`  
**Model Operational Status:** `EXPERIMENTAL / HEURISTIC-CALIBRATED`  
**Data Provenance Manifest:** [`data/calibrationDatasetManifest.json`](file:///d:/racing-oslo-manager/data/calibrationDatasetManifest.json)  
**Starting XI Forecast Audit:** [`data/xiForecastAudit.json`](file:///d:/racing-oslo-manager/data/xiForecastAudit.json)

---

## 1. Executive Summary & Epistemological Taxonomy

This audit remediates methodological over-claims and false validation artifacts identified in earlier iterations. All statements and parameters across the Racing de Oslo championship engine are now strictly classified under five rigorous categories:

| Category | Definition | Items in Scope |
| :--- | :--- | :--- |
| **FACT (Ground Truth)** | Directly observed from verified Comunio API, news, or transaction records with verified timestamps and source files. | • 314 historical transactions (`web/src/data/historicalTransactions.json`)<br>• 116 player historical season totals across 12 LaLiga seasons (`web/src/data/squad.json`, `web/src/data/rivalsAudit.json`)<br>• Confirmed J5 cumulative standings (Fermín: 245 pts, Racing: 188 pts, etc.)<br>• Confirmed J3 and J5 starting lineups (`data/matchday_predictions.json`) |
| **EMPIRICALLY VALIDATED** | Parameter derived from genuine out-of-sample prediction error minimization on un-leaked historical records. | • Player multi-season prior weights ($0.50 / 0.30 / 0.20$ on seasons $t-1, t-2, t-3$)<br>• Bayesian shrinkage weight $k = 3$ on multi-season player history ($\text{MAE} = 1.353$) |
| **HEURISTIC PRIOR** | Domain-informed rule calibrated for decision safety, explicitly flagged as a prior rather than a statistical fact. | • $P_{35}$ replacement level pricing (~500,000 € to 1.5 M€)<br>• Squad depth penalty factor ($0.95$ for 11 players; $1.0$ for $\ge 12$ players)<br>• Availability penalty ($1.0 - (\text{injuries}/11) \times 0.35$)<br>• Auto-bid guardrails (100% – 125% VM) |
| **ASSUMPTION** | Mathematical convenience or engineering modeling premise adopted in the absence of complete joint distributions. | • Standard Normal Box-Muller transform for matchday score residuals ($\text{Status: ASSUMED\_NOT\_VALIDATED}$)<br>• Cross-team independence in Monte Carlo simulations ($\text{Assumption: INDEPENDENT}$) |
| **INSUFFICIENT DATA** | Data that cannot be honestly observed or verified; explicitly prevented from being fabricated. | • Individual round-by-round matchday scores (J1, J2, J4) for all rival clubs (`INSUFFICIENT_DATA_FOR_EMPIRICAL_RECALIBRATION`)<br>• Empirical cross-club covariance matrix |

---

## 2. Critical Audit Findings & Resolutions

### Finding 1: Target Leakage via Synthetic Club Matchday Arrays
- **Issue:** Earlier backtesting scripts created synthetic arrays (`[48, 52, 45, 50, 50]`, `[38, 36, 40, ...]`) to simulate round-by-round walk-forward testing. Because these numbers were back-calculated to hit the J5 cumulative total, this represented target leakage.
- **Remediation:** Synthetic arrays are **strictly excluded** from canonical empirical claims. `CalibrationEngine.buildClubObservations({ allowSynthetic: false })` loads only confirmed real snapshots. In `data/calibrationDatasetManifest.json`, intermediate rival rounds are formally registered with status `INSUFFICIENT_DATA_FOR_EMPIRICAL_RECALIBRATION`.

### Finding 2: Starting XI Point Expectation Audit (51.7 vs 66.7)
- **Issue:** The figure 66.7 pts appeared in unconstrained scratch scripts that summed departed players or failed to apply the Comunio 11-player constraint.
- **Remediation:** Full audit persisted in `data/xiForecastAudit.json`. Racing's actual 11 starters produce **51.7 pts** (`currentXiScore`).
- **Symmetric Season Modeling:** An 11-player squad with zero bench has depth fragility. The rest-of-season expected matchday score is **49.1 pts** (`restOfSeasonExpectedPPM` $= 51.7 \times 0.95$). This prevents asymmetric comparisons against rival season averages.

### Finding 3: Dynamic Prior Weight Optimization
- **Issue:** Prior weight testing previously returned static values without recomputing per configuration.
- **Remediation:** `CalibrationEngine.optimizeHistoricalPriorWeights()` now recalculates the weighted sum dynamically for every configuration (`50_30_20`, `60_30_10`, `40_35_25`, `equal_33`) using each player's true prior season points series.

### Finding 4: Replacement Level & Residual Diagnostics Status
- **Issue:** $P_{35}$ was previously labeled `OPTIMAL_CALIBRATED_BENCHMARK` and Gaussian residuals were claimed as empirically proven.
- **Remediation:** $P_{35}$ is now labeled `HEURISTIC_PRIOR`. Residual distribution is labeled `ASSUMED_NOT_VALIDATED` with explicit documentation that Box-Muller sampling is an operational assumption. Cross-team correlation returns `{ estimate: null, confidence: "INSUFFICIENT_DATA", simulationAssumption: "INDEPENDENT" }`.

---

## 3. Verified Starting XI Audit Table (`data/xiForecastAudit.json`)

| Player | Position | Market Value | Match Expected | Season Projected | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **David Soria** | POR | 4,450,000 € | **7.3 pts** | 207 pts | Disponible |
| **Adrián de la Fuente** | DEF | 3,900,000 € | **6.1 pts** | 157 pts | Disponible |
| **Aïssa Mandi** | DEF | 4,450,000 € | **5.3 pts** | 145 pts | Disponible |
| **Alexander-Arnold** | DEF | 3,930,000 € | **4.5 pts** | 145 pts | Disponible |
| **Íñigo Arguibide** | DEF | 1,250,000 € | **1.7 pts** | 105 pts | Disponible |
| **Fede Valverde** | MED | 14,890,000 € | **7.5 pts** | 240 pts | Disponible |
| **Johnny Cardoso** | MED | 1,440,000 € | **1.8 pts** | 105 pts | Disponible |
| **Pol Lozano** | MED | 250,000 € | **0.2 pts** | 85 pts | Disponible |
| **Gerard Moreno** | DEL | 8,940,000 € | **6.3 pts** | 190 pts | Disponible |
| **Mariano Díaz** | DEL | 6,650,000 € | **7.0 pts** | 145 pts | Disponible |
| **Hugo Duro** | DEL | 2,750,000 € | **4.0 pts** | 147 pts | Disponible |
| **Total XI (Single Match)** | **4-3-3** | **52,900,000 €** | **51.7 pts** | **1,671 pts** | **11 Starters** |
| **Rest of Season Expected PPM** | Fragility Factor: $0.95$ | — | **49.1 pts** | — | — |

---

## 4. Championship Monte Carlo Baseline

Using Common Random Numbers (CRN) with 10,000 iterations over 33 remaining matchdays:
- **Leader (Fermín Gadura F.C.):** 245 pts current, $52.5$ mean PPM $\to \mathbf{1,978\text{ expected final points}}$.
- **Racing de Oslo (Actual Baseline):** 188 pts current, $48.5 - 49.1$ mean PPM $\to \mathbf{1,808\text{ expected final points}}$.
- **Deficit:** $-57$ pts.
- **Baseline Title Probability:** $P(\text{Win}) = \mathbf{2.8\%}$ (95% Wilson CI: $[2.5\%, 3.1\%]$).

---

## 5. Integrity Verification Checklist

- [x] All synthetic matchday progressions tagged `isSynthetic: true` and excluded from empirical claims.
- [x] Dataset manifest created at [`data/calibrationDatasetManifest.json`](file:///d:/racing-oslo-manager/data/calibrationDatasetManifest.json).
- [x] Dynamic prior weight optimization tested on real season logs.
- [x] Multi-season naming standardized (`previousSeasonPPM`, `previous3SeasonMeanPPM`).
- [x] Replacement level and residual modeling categorized as `HEURISTIC_PRIOR` and `ASSUMED_NOT_VALIDATED`.
- [x] Team correlation marked `INSUFFICIENT_DATA` with explicit `INDEPENDENT` assumption.
- [x] Model operational status set to `EXPERIMENTAL`.
- [x] 11/11 Phase 3B integrity tests passing in [`test/phase3b_integrity_audit.test.mjs`](file:///d:/racing-oslo-manager/test/phase3b_integrity_audit.test.mjs).
