# 🛡️ PHASE 3B / 3B.1 — CALIBRATION INTEGRITY & MODEL SELECTION AUDIT REPORT

**Repository:** `azfalot/racing-oslo-manager`  
**Audit Date:** 2026-09-13  
**Auditor:** Quantitative Integrity & Validation System  
**Production Model Version:** `RDO-FORECAST-3.0`  
**Production Model Status:** `HEURISTIC_BASELINE`  
**Experimental Model Version:** `RDO-EXP-3.1`  
**Data Provenance Manifest:** [`data/calibrationDatasetManifest.json`](file:///d:/racing-oslo-manager/data/calibrationDatasetManifest.json)  
**Starting XI Forecast Audit:** [`data/xiForecastAudit.json`](file:///d:/racing-oslo-manager/data/xiForecastAudit.json)

---

## 1. Epistemological Taxonomy & Integrity Summary

| Category | Definition | Verified In-Scope Items |
| :--- | :--- | :--- |
| **FACT (Ground Truth)** | Directly observed from verified Comunio API, news, or transaction records. | • 314 historical transactions<br>• 116 player historical season totals over 12 LaLiga seasons<br>• Confirmed J5 standings snapshot (Fermín: 245 pts, Racing: 188 pts)<br>• Confirmed J3 and J5 pre-deadline starting lineups |
| **EMPIRICALLY VALIDATED** | Programmatically derived from out-of-sample prediction error minimization on genuine un-leaked historical records. | • Player multi-season prior weights ($0.60 / 0.30 / 0.10$ on seasons $t-1, t-2, t-3$; $\text{MAE} = 1.353$, $\text{RMSE} = 1.754$, $\text{Bias} = -0.606$)<br>• Candidate configurations tested dynamically |
| **HEURISTIC PRIOR** | Domain-informed rule calibrated for decision safety, explicitly flagged as a prior rather than a statistical fact. | • $P_{35}$ replacement level pricing (~500k € to 1.5 M€)<br>• Bayesian shrinkage weight $k = 3$ (labeled `HEURISTIC_PRIOR` due to cross-season sample limitations)<br>• Squad depth penalty factor ($0.95$ for 11 players; $1.0$ for $\ge 12$ players)<br>• Availability penalty ($1.0 - (\text{injuries}/11) \times 0.35$)<br>• Auto-bid guardrails (100% – 125% VM) |
| **ASSUMPTION** | Mathematical convenience or engineering modeling premise adopted in the absence of complete joint distributions. | • Standard Normal Box-Muller transform for matchday score residuals ($\text{Status: ASSUMED\_NOT\_VALIDATED}$, $\text{sampleSize} = 0$, $\text{empiricalMetrics} = \text{null}$)<br>• Cross-team independence in Monte Carlo simulations ($\text{Assumption: INDEPENDENT}$) |
| **INSUFFICIENT DATA** | Data that cannot be honestly observed or verified; explicitly prevented from being fabricated. | • Real intermediate round-by-round point logs (J1, J2, J4) for all rival clubs (`teamModel.status = "INSUFFICIENT_DATA"`, `gridSearchBest = null`)<br>• Empirical cross-club covariance matrix |

---

## 2. Phase 3B.1 Integrity Remediation Checklist

1. **Zero Synthetic Data in Production Calibration:**
   - `CalibrationEngine.runFullCalibrationProtocol()` consumes **0** synthetic observations.
   - `buildSyntheticClubObservationsForTesting()` is strictly isolated for test fixtures.
   - Real intermediate round targets available: **0**.
   - `teamModel.status` = `"INSUFFICIENT_DATA"`, `bestMAE` = `null`, `bestRMSE` = `null`.

2. **No Synthetic Residual Metrics:**
   - `residualDistribution` returns `{ distributionSelected: "GAUSSIAN_NORMAL", distributionStatus: "ASSUMED_NOT_VALIDATED", sampleSize: 0, empiricalMetrics: null }`.

3. **Accurate Player Metric Semantics:**
   - The `/ 34` historical seasonal divisor is formally defined as `seasonPointsPerLeagueRound`.
   - Explicitly records `pointsPerAppearance: null` and `pointsPerStart: null` to avoid implying conditional scoring per appearance.

4. **Programmatic Parameter Selection:**
   - Historical prior weights: Candidate evaluation selected **`60_30_10`** ($\text{MAE} = 1.353$) over `50_30_20` ($\text{MAE} = 1.368$), `40_35_25` ($\text{MAE} = 1.392$), and `equal_33` ($\text{MAE} = 1.414$).
   - Shrinkage $K$: Selected programmatically and flagged with `status: "HEURISTIC_PRIOR"`.

5. **Symmetric Monte Carlo Season Simulation:**
   - `ACTUAL_BASELINE` runs symmetric aggregate forecasting for ALL clubs (Racing aggregate PPM: $36.8 - 48.5$, Fermín: $48.0 - 52.5$).
   - Racing's peak Starting XI score ($51.7$ pts) is separated into `racing.currentXiExpectedPoints` and is NOT used to artificially uplift Racing against aggregate rivals.
   - `EXPECTED_AVAILABLE_XI` and `FULL_STRENGTH_XI` refuse asymmetric comparisons, returning `status: "NOT_REPORTABLE_ASYMMETRIC_INPUTS"`, `racing.pWin = null` unless comparable XI data exists for all clubs.

6. **Production Model Status Gate:**
   - Output explicitly tracks `productionModelVersion: "RDO-FORECAST-3.0"`, `productionModelStatus: "HEURISTIC_BASELINE"`, and `experimentalModelVersion: "RDO-EXP-3.1"`.

---

## 3. Starting XI Audit Table (`data/xiForecastAudit.json`)

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
| **Current Starting XI (Single Match)** | **4-3-3** | **52,900,000 €** | **51.7 pts** | **1,671 pts** | **11 Starters** |
| **Rest of Season Aggregate Baseline PPM** | Symmetric Baseline | — | **36.8 – 48.5 pts** | — | — |
