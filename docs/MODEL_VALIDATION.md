# 🔬 MODEL VALIDATION & EMPIRICAL CALIBRATION REPORT (PHASE 3 / 3B)

**Model Version:** `RDO-FORECAST-3.0`  
**Operational Status:** `EXPERIMENTAL / HEURISTIC-CALIBRATED`  
**Repository:** `azfalot/racing-oslo-manager`  
**Date of Audit:** 2026-09-13  
**League:** Comunio — *Segunda Regional Cántabra* (10 Clubs)  
**Trained Through Matchday:** Jornada 5  
**Data Provenance Manifest:** [`data/calibrationDatasetManifest.json`](file:///d:/racing-oslo-manager/data/calibrationDatasetManifest.json)  
**Integrity Audit Reference:** [`docs/PHASE3_INTEGRITY_AUDIT.md`](file:///d:/racing-oslo-manager/docs/PHASE3_INTEGRITY_AUDIT.md)

---

## 1. Epistemological Classification

Every parameter and forecast in the system belongs to one of the following explicit categories:

1. **FACT (Ground Truth):** 314 market transactions, 116 player historical season totals over 12 LaLiga seasons, J5 standings (Fermín 245 pts, Racing 188 pts), J3 & J5 confirmed lineups.
2. **EMPIRICALLY VALIDATED:** Multi-season prior weights ($0.50 / 0.30 / 0.20$), shrinkage parameter $k = 3$ on multi-season player history ($\text{MAE} = 1.353$).
3. **HEURISTIC PRIOR:** $P_{35}$ replacement level pricing, depth penalty ($0.95$ for 11 players), availability penalty ($0.35$ per missing starter).
4. **ASSUMPTION:** Standard Normal Box-Muller residual error model (`ASSUMED_NOT_VALIDATED`), cross-team independence in Monte Carlo simulations (`INDEPENDENT`).
5. **INSUFFICIENT DATA:** Round-by-round point scores for J1, J2, J4 of rival clubs (`INSUFFICIENT_DATA_FOR_EMPIRICAL_RECALIBRATION`).

---

## 2. Executive Summary & Acceptance Criterion

> **The Phase 3 Core Question:**  
> *"What evidence shows that this forecast is better than simply using the player's or team's current average?"*

### Empirical Findings:
1. **Player-Level Multi-Season Empirical-Bayes Shrinkage:**
   - **Baseline $P_1$ (Previous Season Only):** $\text{MAE} = 1.411$, $\text{RMSE} = 1.824$.
   - **Baseline $P_2$ (Last 3 Season Unweighted Mean):** $\text{MAE} = 1.414$, $\text{RMSE} = 1.839$.
   - **Selected Model ($k=3$ Shrinkage with 3-Season Prior $0.50/0.30/0.20$):** $\text{MAE} = 1.353$, $\text{RMSE} = 1.755$, $\text{Bias} = -0.648$.
   - **Result:** Multi-season recency-weighted prior outperforms single-season or unweighted averages by **+4.1% lower MAE**.

2. **Squad Value Ablation:**
   - Grid search confirmed that once season scoring exists, squad market value adds zero positive predictive value ($w_{\text{squad}} = 0.00$).
   - Market values reflect auction dynamics and inflation, not points efficiency.

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

## 4. Championship Monte Carlo Simulation Baseline

- **Leader (Fermín Gadura F.C.):** 245 pts, 52.5 mean PPM $\to \mathbf{1,978\text{ expected final points}}$.
- **Racing de Oslo (Baseline):** 188 pts, 49.1 mean PPM $\to \mathbf{1,808\text{ expected final points}}$.
- **Current Deficit:** $-57$ pts with 33 matchdays remaining.
- **Baseline Title Probability:** $P(\text{Win}) = \mathbf{2.8\%}$ (95% Wilson CI: $[2.5\%, 3.1\%]$).
