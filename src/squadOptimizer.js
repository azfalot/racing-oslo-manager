/**
 * Squad Optimizer — Pure-function module for squad-level decision making.
 *
 * Every function in this module is deterministic and side-effect-free.
 * It depends on ComunioEngine for lineup optimization but never calls
 * external APIs, writes files, or sends messages.
 */

import fs from 'fs';
import { evaluateClubCompetition } from './clubCompetition.js';
import { evaluateClubMomentum } from './clubMomentum.js';
import { isVerifiedComputerOwner } from './ownership.js';
import { calculateVORP, identifyPositionalWeaknesses, calculateDepthFragility } from './vorpEngine.js';

// ── CONFIGURATION ──────────────────────────────────────────────────────────────

function loadStrategyConfig() {
  try {
    if (fs.existsSync('config.json')) {
      const raw = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      return raw.strategy || {};
    }
  } catch (e) {}
  return {};
}

const DEFAULT_STRATEGY = {
  purchase: {
    weights: {
      squadUpgrade: 0.40,
      absoluteQuality: 0.20,
      positionNeed: 0.15,
      marketOpportunity: 0.10,
      rivalPressure: 0.10,
      riskAdjustment: -0.05
    },
    minMarginalXIUpgrade: 3,
    safetyReserveMin: 1000000,
    bands: {
      speculationMaxPct: 2,
      depthMaxPct: 5,
      clearUpgradeMaxPct: 15,
      eliteMaxPct: 25
    }
  },
  sale: {
    minReplacementLossForProtection: 10
  },
  risk: {
    injuredPlayerWeight: 0.1,
    doubtfulPlayerWeight: 0.4
  },
  liquidity: {
    autoBidLimit: 8,
    criticalPurchasePctBalance: 0.40
  },
  season: {
    totalMatchdays: 38,
    currentMatchday: null
  }
};

export function getStrategy() {
  const loaded = loadStrategyConfig();
  // Deep merge loaded over defaults
  return deepMerge(DEFAULT_STRATEGY, loaded);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
        && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ── SQUAD VALUE ────────────────────────────────────────────────────────────────

/**
 * Total expected points of the optimal XI for a given squad.
 * @param {ComunioEngine} engine
 * @param {{ players: Array }} squad
 * @returns {number} Total expected points of best lineup
 */
export function calculateSquadValue(engine, squad) {
  const lineup = engine.optimizeLineup(squad);
  return lineup.score || 0;
}

// ── MARGINAL VALUE ─────────────────────────────────────────────────────────────

/**
 * How much adding `candidate` improves the best XI, and precisely who is replaced.
 *
 *   marginalValue = bestXI(squad + candidate) - bestXI(squad)
 *
 * Returns 0 if the candidate does not enter the optimal lineup.
 *
 * @param {ComunioEngine} engine
 * @param {{ players: Array }} squad
 * @param {Object} candidate  Market player object
 * @returns {{ marginalValue: number, entersXI: boolean, currentSquadValue: number, newSquadValue: number, replacedPlayer: Object|null, replacedPlayerName: string|null, replacedPlayerExpectedPoints: number }}
 */
export function calculateMarginalValue(engine, squad, candidate) {
  const baseLineup = engine.optimizeLineup(squad);
  const currentValue = baseLineup.score || 0;

  // Build hypothetical squad with candidate added
  const hypotheticalPlayers = [...(squad.players || []), candidate];
  const hypotheticalSquad = { ...squad, players: hypotheticalPlayers };
  const newLineup = engine.optimizeLineup(hypotheticalSquad);
  const newValue = newLineup.score || 0;

  const marginalValue = parseFloat((newValue - currentValue).toFixed(1));
  const candidateId = candidate.playerId || candidate.id;
  const entersXI = (newLineup.starting11 || []).some(
    p => (p.playerId || p.id) === candidateId
  );

  // Identify who was replaced in the Starting XI
  let replacedPlayer = null;
  let replacedPlayerName = null;
  let replacedPlayerExpectedPoints = 0;

  if (entersXI && baseLineup.starting11) {
    const newXIIds = new Set((newLineup.starting11 || []).map(p => p.playerId || p.id));
    const droppedStarter = (baseLineup.starting11 || []).find(p => !newXIIds.has(p.playerId || p.id));
    if (droppedStarter) {
      replacedPlayer = droppedStarter;
      replacedPlayerName = droppedStarter.name;
      replacedPlayerExpectedPoints = droppedStarter.expectedPoints || 0;
    }
  }

  return {
    marginalValue,
    entersXI,
    currentSquadValue: currentValue,
    newSquadValue: newValue,
    replacedPlayer,
    replacedPlayerName,
    replacedPlayerExpectedPoints
  };
}

// ── REPLACEMENT LOSS ───────────────────────────────────────────────────────────

/**
 * How much REMOVING a player degrades the best XI.
 *
 *   replacementLoss = bestXI(squad) - bestXI(squad - player)
 *
 * A high replacementLoss means the player is a core member.
 * A low replacementLoss means the player is redundant (not in XI or easily replaceable).
 *
 * @param {ComunioEngine} engine
 * @param {{ players: Array }} squad
 * @param {Object} playerToRemove
 * @returns {{ replacementLoss: number, wasInXI: boolean }}
 */
export function calculateReplacementLoss(engine, squad, playerToRemove) {
  const currentLineup = engine.optimizeLineup(squad);
  const currentValue = currentLineup.score || 0;

  const pid = playerToRemove.playerId || playerToRemove.id;
  const wasInXI = (currentLineup.starting11 || []).some(
    p => (p.playerId || p.id) === pid
  );

  // Build squad without the player
  const reducedPlayers = (squad.players || []).filter(
    p => (p.playerId || p.id) !== pid
  );
  const reducedSquad = { ...squad, players: reducedPlayers };
  const reducedValue = calculateSquadValue(engine, reducedSquad);

  let replacementLoss = currentValue - reducedValue;

  // Si la posición queda totalmente huérfana (ej: único portero de la plantilla), la pérdida deportiva es crítica
  const remainingInPos = reducedPlayers.filter(p => (p.type || p.position) === (playerToRemove.type || playerToRemove.position));
  if (remainingInPos.length === 0 && (playerToRemove.type === 'keeper' || playerToRemove.position === 'keeper')) {
    replacementLoss = Math.max(50, replacementLoss * 10);
  }

  return { replacementLoss, wasInXI };
}

// ── POSITION NEED ──────────────────────────────────────────────────────────────

/**
 * Normalized position-need score (0.0 = no need, 1.0 = critical need).
 *
 * Considers:
 * - Number of viable starters (available + quality)
 * - Number of available substitutes
 * - Quality gap between best and worst starter in that position
 * - Formation constraints (how many formations can use this position depth)
 *
 * @param {ComunioEngine} engine
 * @param {{ players: Array }} squad
 * @param {string} position  'keeper' | 'defender' | 'midfielder' | 'striker'
 * @returns {{ need: number, viableStarters: number, totalInPosition: number, qualityGap: number, reason: string }}
 */
export function calculatePositionNeed(engine, squad, position) {
  const players = (squad.players || []).filter(
    p => (p.type || p.position) === position
  );

  const available = players.filter(p => engine.isPlayerAvailable(p));
  const scored = available.map(p => ({
    ...p,
    ep: engine.getExpectedPoints(p)
  })).sort((a, b) => b.ep - a.ep);

  // Determine how many starters the most demanding formation needs for this position
  const maxRequired = Math.max(
    ...Object.values(engine.formations).map(f => f[position] || 0)
  );
  // Typical requirement (median across formations)
  const requirements = Object.values(engine.formations).map(f => f[position] || 0).sort((a, b) => a - b);
  const medianRequired = requirements[Math.floor(requirements.length / 2)];

  const viableStarters = scored.length;
  const qualityGap = scored.length >= 2
    ? scored[0].ep - scored[scored.length - 1].ep
    : 0;

  // Calculate need components
  let need = 0;
  let reason = '';

  if (viableStarters === 0) {
    need = 1.0;
    reason = `No hay jugadores disponibles en ${position}.`;
  } else if (viableStarters < medianRequired) {
    // Critical: can't even fill the median formation
    need = 0.80 + (0.20 * (1 - viableStarters / medianRequired));
    reason = `Solo ${viableStarters} disponible(s) para ${medianRequired} requeridos. Urgencia alta.`;
  } else if (viableStarters === medianRequired) {
    // Exact fit: no substitutes
    need = 0.50;
    reason = `${viableStarters} disponibles = exactamente los requeridos. Sin suplentes.`;
  } else if (viableStarters <= maxRequired) {
    // Adequate but thin
    const surplus = viableStarters - medianRequired;
    need = Math.max(0.15, 0.45 - (surplus * 0.15));
    reason = `${viableStarters} disponibles. Fondo de armario ajustado.`;
  } else {
    // Well stocked
    need = 0.05;
    reason = `${viableStarters} disponibles. Posición bien cubierta.`;
  }

  // Boost need if quality gap is very high (weak backup)
  if (qualityGap > 80 && viableStarters > 1) {
    need = Math.min(1.0, need + 0.15);
    reason += ` Brecha de calidad alta (${qualityGap} pts).`;
  }

  return {
    need: parseFloat(need.toFixed(2)),
    viableStarters,
    totalInPosition: players.length,
    qualityGap,
    reason
  };
}

// ── EXPECTED PERFORMANCE (Season-independent) ──────────────────────────────────

/**
 * Season-independent player performance projection.
 *
 * Returns PPM-based metrics instead of absolute accumulated points.
 *
 * @param {Object} player
 * @param {Object} strategyConfig  The strategy section from config
 * @returns {{ ppm: number, expectedRemainingPoints: number, recentForm: number, historicalBaseline: number, efficiency: number }}
 */
export function getExpectedPerformance(player, strategyConfig = null) {
  const strategy = strategyConfig || getStrategy();
  const totalMatchdays = strategy.season?.totalMatchdays || 38;
  const currentMatchday = strategy.season?.currentMatchday || estimateCurrentMatchday();

  const matchdaysRemaining = Math.max(1, totalMatchdays - currentMatchday);
  const matchdaysPlayed = Math.max(1, currentMatchday);

  // 1. Historical recency-weighted prior PPM (0.50/0.30/0.20 last 3 seasons)
  const historicalPPM = calculateHistoricalPriorPPM(player);

  // 2. Current season average points
  const avgPoints = parseFloat(
    player.average?.points ? String(player.average.points).replace(',', '.') : '0'
  );
  const seasonPPM = (!isNaN(avgPoints) && avgPoints > 0) ? avgPoints : 0;

  // 3. Recent match scores
  const recentScores = Array.isArray(player.lastMatches || player.recentScores)
    ? (player.lastMatches || player.recentScores).filter(s => typeof s === 'number')
    : [];

  // 4. Empirical-Bayes shrinkage towards historical prior
  const shrinkageResult = calculateRecencyWeightedPPM(player, recentScores.length > 0 ? recentScores : (seasonPPM > 0 ? [seasonPPM] : []), 3);
  let effectivePPM = shrinkageResult.posteriorPPM;
  let recentForm = shrinkageResult.sampleMean;

  // 5. Health adjustment
  const statusLower = ((player.status || '') + ' ' + (player.statusInfo || '')).toLowerCase();
  if (statusLower.includes('duda') || statusLower.includes('molestias')) {
    effectivePPM *= (strategy.risk?.doubtfulPlayerWeight || 0.4);
  }

  // 6. Positional Club Competition Modifier (Compañeros de puesto en su club)
  const competition = evaluateClubCompetition(player);
  let competitionMultiplier = 1.0;
  if (competition.competitionLevel === 'BAJA') competitionMultiplier = 1.05;
  else if (competition.competitionLevel === 'ALTA') competitionMultiplier = 0.90;

  // 6.1. Real Club Momentum Modifier (Estado de ánimo, crisis y dinámica de su club)
  const momentum = evaluateClubMomentum(player);
  const momentumMultiplier = momentum.momentumMultiplier || 1.0;

  effectivePPM *= (competitionMultiplier * momentumMultiplier);
  const expectedRemainingPoints = effectivePPM * matchdaysRemaining;

  // 7. Economic efficiency: expected remaining points per million
  const priceInM = Math.max(0.1, (player.price || 100000) / 1000000);
  const efficiency = expectedRemainingPoints / priceInM;

  // 8. Starter Status Classification (Minutos y probabilidad de titularidad en equipo real)
  let starterStatus = 'ROTACION_HABITUAL';
  let starterTag = '🔄 Rotación Habitual';
  let starterProbability = (competition.confidencePct / 100);

  const bestHistorical = Array.isArray(player.historical)
    ? Math.max(0, ...player.historical.map(h => parseInt(h.points) || 0))
    : (historicalPPM * 34);

  if (effectivePPM >= 4.0 || bestHistorical >= 120 || competition.isUndisputed) {
    starterStatus = 'TITULAR_INDISCUTIBLE';
    starterTag = '⭐ Titular Fijo';
    starterProbability = Math.max(0.90, competition.confidencePct / 100);
  } else if (effectivePPM < 2.5 && bestHistorical < 60) {
    starterStatus = 'SUPLENTE_RESIDUAL';
    starterTag = '⚠️ Suplente Residual';
    starterProbability = Math.min(0.40, competition.confidencePct / 100);
  }

  return {
    ppm: parseFloat(effectivePPM.toFixed(2)),
    expectedRemainingPoints: Math.round(expectedRemainingPoints),
    recentForm: parseFloat(recentForm.toFixed(2)),
    historicalBaseline: parseFloat(historicalPPM.toFixed(2)),
    efficiency: parseFloat(efficiency.toFixed(1)),
    starterStatus,
    starterTag,
    starterProbability: parseFloat(starterProbability.toFixed(2)),
    competition,
    momentum
  };
}

/**
 * Heuristic to estimate current matchday based on calendar.
 * LaLiga typically runs mid-August to late May.
 */
function estimateCurrentMatchday() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  // August = start (matchday 1-3)
  if (month === 7) return Math.min(3, Math.max(1, Math.floor((day - 10) / 7) + 1));
  // September-May: ~4 matchdays/month
  if (month >= 8) return Math.min(38, 3 + (month - 8) * 4 + Math.floor(day / 8));
  // January-May
  if (month >= 0 && month <= 4) return Math.min(38, 19 + month * 4 + Math.floor(day / 8));
  // June-July: season over
  return 38;
}

// ── STRATEGIC PURCHASE SCORE ───────────────────────────────────────────────────

/**
 * Composite strategic score for a purchase candidate.
 *
 * Components (all normalized 0-100):
 *   squadUpgrade     — How much the XI improves
 *   absoluteQuality  — How good the player is independently
 *   positionNeed     — How much the position needs reinforcement
 *   marketOpportunity— Price efficiency (points per million)
 *   rivalPressure    — Likely competition for this player
 *   riskAdjustment   — Penalty for injury/doubt/no data
 *
 * @param {ComunioEngine} engine
 * @param {Object} candidate
 * @param {{ players: Array }} squad
 * @param {number} balance
 * @param {Object|null} rivalIntel  Optional rival intelligence data
 * @returns {{ score: number, components: Object, action: string, reasoning: string[] }}
 */
export function calculateStrategicPurchaseScore(engine, candidate, squad, balance, rivalIntel = null) {
  const strategy = getStrategy();
  const weights = strategy.purchase?.weights || DEFAULT_STRATEGY.purchase.weights;

  // Comprobar disponibilidad estricta (sanciones, rojas, lesiones)
  const isAvailable = engine.isPlayerAvailable(candidate);
  const isComputer = isVerifiedComputerOwner(candidate);

  if (!isAvailable) {
    const statusDesc = candidate.status || candidate.statusInfo || 'Sancionado/No disponible';
    return {
      score: 0,
      components: {
        squadUpgrade: { raw: 0, weight: weights.squadUpgrade, marginalValue: 0 },
        absoluteQuality: { raw: 0, weight: weights.absoluteQuality, ppm: 0 },
        positionNeed: { raw: 0, weight: weights.positionNeed, detail: 'No disponible' },
        marketOpportunity: { raw: 0, weight: weights.marketOpportunity, efficiency: 0 },
        rivalPressure: { raw: 0, weight: weights.rivalPressure },
        riskAdjustment: { raw: 100, weight: weights.riskAdjustment }
      },
      action: 'PASS',
      reasoning: [`⛔ DESCARTADO: Jugador no disponible o sancionado (${statusDesc}). No podrá jugar la próxima jornada.`],
      performance: { ppm: 0, expectedRemainingPoints: 0, recentForm: 0, historicalBaseline: 0, efficiency: 0 },
      entersXI: false,
      marginalValue: 0
    };
  }

  // 1. Squad upgrade (0-100) — Normalizado por mejora de puntos por jornada (3.0+ pts/jornada = 100)
  const { marginalValue, entersXI, replacedPlayer, replacedPlayerName, replacedPlayerExpectedPoints } = calculateMarginalValue(engine, squad, candidate);
  const squadUpgradeRaw = Math.max(0, Math.min(100, (marginalValue / 3.0) * 100));

  // 2. Absolute quality (0-100)
  const perf = getExpectedPerformance(candidate, strategy);
  // PPM de 6+ = 100, 0 = 0
  const absoluteQualityRaw = Math.max(0, Math.min(100, (perf.ppm / 6) * 100));

  // 3. Position need (0-100)
  const posNeed = calculatePositionNeed(engine, squad, candidate.type || candidate.position);
  const positionNeedRaw = posNeed.need * 100;

  // 4. Market opportunity / efficiency (0-100)
  // Efficiency of 40+ pts/M€ = 100, 0 = 0
  const efficiencyRaw = Math.max(0, Math.min(100, (perf.efficiency / 40) * 100));

  // 5. Rival pressure (0-100)
  let rivalPressureRaw = 20; // Default moderate
  if (rivalIntel) {
    const avgOverbid = rivalIntel.avgCommunityOverbid || 5;
    // Higher community overbid = more competition
    rivalPressureRaw = Math.min(100, avgOverbid * 6);

    // If owned by a rival (not Computer), higher competition
    if (!isComputer) {
      rivalPressureRaw = Math.min(100, rivalPressureRaw + 20);
    }
  }

  // 6. Risk adjustment (0-100, higher = more risk)
  let riskRaw = 10; // Base risk
  const statusLower = ((candidate.status || '') + ' ' + (candidate.statusInfo || '')).toLowerCase();
  if (statusLower.includes('duda') || statusLower.includes('molestias')) {
    riskRaw = 60;
  }
  // No historical data = higher uncertainty
  const historyList = Array.isArray(candidate.historical)
    ? candidate.historical
    : (candidate.historical?.points || []);
  if (historyList.length === 0) {
    riskRaw = Math.min(100, riskRaw + 25);
  }

  // Weighted composite
  const score =
    (squadUpgradeRaw * weights.squadUpgrade) +
    (absoluteQualityRaw * weights.absoluteQuality) +
    (positionNeedRaw * weights.positionNeed) +
    (efficiencyRaw * weights.marketOpportunity) +
    (rivalPressureRaw * weights.rivalPressure) +
    (riskRaw * weights.riskAdjustment); // Negative weight = penalty

  const components = {
    squadUpgrade: { raw: parseFloat(squadUpgradeRaw.toFixed(1)), weight: weights.squadUpgrade, marginalValue },
    absoluteQuality: { raw: parseFloat(absoluteQualityRaw.toFixed(1)), weight: weights.absoluteQuality, ppm: perf.ppm },
    positionNeed: { raw: parseFloat(positionNeedRaw.toFixed(1)), weight: weights.positionNeed, detail: posNeed.reason },
    marketOpportunity: { raw: parseFloat(efficiencyRaw.toFixed(1)), weight: weights.marketOpportunity, efficiency: perf.efficiency },
    rivalPressure: { raw: parseFloat(rivalPressureRaw.toFixed(1)), weight: weights.rivalPressure },
    riskAdjustment: { raw: parseFloat(riskRaw.toFixed(1)), weight: weights.riskAdjustment }
  };

  // Build reasoning
  const reasoning = [];
  let replacedPpm = 0;
  let strictlyBeatsReplaced = false;

  if (entersXI && replacedPlayer) {
    const replacedPerf = getExpectedPerformance(replacedPlayer, strategy);
    replacedPpm = replacedPerf.ppm;
    strictlyBeatsReplaced = perf.ppm > replacedPpm && marginalValue > 0;

    const replacedMsg = replacedPlayerName ? ` sustituyendo a ${replacedPlayerName} (${replacedPpm} PPM)` : '';
    reasoning.push(`✅ Entra en el XI titular (+${marginalValue} pts al Once Ideal${replacedMsg}).`);

    if (strictlyBeatsReplaced) {
      reasoning.push(`🚀 Supera el promedio con momentum del titular actual (${perf.ppm} PPM > ${replacedPpm} PPM).`);
    } else {
      reasoning.push(`⚠️ Alerta: El promedio con momentum (${perf.ppm} PPM) no supera holgadamente a ${replacedPlayerName} (${replacedPpm} PPM).`);
    }
  } else if (entersXI) {
    reasoning.push(`✅ Entra en el XI titular (+${marginalValue} pts al Once Ideal).`);
  } else if (marginalValue > 0) {
    reasoning.push(`📈 Mejora el fondo de armario (+${marginalValue} pts de profundidad).`);
  } else {
    reasoning.push(`⚠️ No mejora el XI actual (mejora marginal: ${marginalValue} pts).`);
  }

  if (posNeed.need >= 0.60) {
    reasoning.push(`🔴 Posición con necesidad ALTA: ${posNeed.reason}`);
  } else if (posNeed.need >= 0.30) {
    reasoning.push(`🟡 Posición con necesidad MODERADA: ${posNeed.reason}`);
  }

  reasoning.push(`📊 ${perf.starterTag} (PPM: ${perf.ppm} | Fiabilidad: ${Math.round(perf.starterProbability * 100)}% minutos | Eficiencia: ${perf.efficiency} pts/M€)`);
  if (perf.momentum && perf.momentum.reasoning) {
    reasoning.push(`🔥 Dinámica de club: ${perf.momentum.reasoning}`);
  }
  if (perf.competition && perf.competition.reasoning) {
    reasoning.push(`⚔️ Competencia en club: ${perf.competition.reasoning}`);
  }

  // Determine action type
  const minUpgrade = strategy.purchase?.minMarginalXIUpgrade || 3;
  let action;
  if (marginalValue < minUpgrade && posNeed.need < 0.50 && score < 45) {
    action = 'PASS';
    reasoning.push(`⛔ Mejora insuficiente (${marginalValue} < ${minUpgrade} pts) y posición cubierta.`);
  } else {
    action = 'RECOMMEND'; // Will be refined by affordability check in calculateMaxRationalBid
  }

  return {
    score: parseFloat(score.toFixed(1)),
    components,
    action,
    reasoning,
    performance: perf,
    entersXI,
    marginalValue,
    replacedPlayer,
    replacedPlayerName,
    replacedPlayerExpectedPoints,
    replacedPlayerPpm: replacedPpm,
    strictlyBeatsReplaced
  };
}

// ── COST PER MARGINAL POINT (CPMP) ──────────────────────────────────────────

/**
 * Calculates Cost Per Marginal Point (CPMP) for candidate.
 *
 *   CPMP (Matchday) = Price / DeltaXI
 *   CPMP (Season)   = Price / (DeltaXI * remainingMatchdays)
 */
export function calculateCostPerMarginalPoint(candidate, marginalValue, remainingMatchdays = 34) {
  const price = candidate.price || candidate.quotedPrice || 0;
  if (!marginalValue || marginalValue <= 0) {
    return {
      cpmpPerMatchday: Infinity,
      cpmpSeason: Infinity,
      totalPointsGained: 0,
      efficiencyRating: 'POOR'
    };
  }

  const cpmpPerMatchday = Math.round(price / marginalValue);
  const totalPointsGained = Math.round(marginalValue * remainingMatchdays);
  const cpmpSeason = totalPointsGained > 0 ? Math.round(price / totalPointsGained) : Infinity;

  let efficiencyRating = 'POOR';
  if (cpmpSeason < 50000) efficiencyRating = 'ELITE';
  else if (cpmpSeason < 100000) efficiencyRating = 'HIGH';
  else if (cpmpSeason < 200000) efficiencyRating = 'MODERATE';

  return {
    cpmpPerMatchday,
    cpmpSeason,
    totalPointsGained,
    efficiencyRating
  };
}

// ── SQUAD ROLE CLASSIFICATION ──────────────────────────────────────────────────

/**
 * Classifies all squad players into quantitative strategic roles:
 * - CORE: Essential starter (high replacement loss >= 8 or only keeper or star asset)
 * - STARTER: Regular starting XI member (replacement loss 3-8 pts)
 * - UPGRADEABLE: Starting XI member with low ceiling / high upgrade gap
 * - DEPTH: Essential backup for rotation / fragility prevention
 * - SPECULATIVE: Short-term injury rehabilitation or high revaluation asset
 * - SELL: Expendable asset / negative VORP to be monetized for upgrades
 */
export function classifySquadRoles(engine, squad) {
  if (!squad || !squad.players || squad.players.length === 0) return [];

  const lineup = engine.optimizeLineup(squad);
  const starterIds = new Set((lineup.starting11 || []).map(p => p.playerId || p.id));
  const weaknesses = identifyPositionalWeaknesses(engine, squad);
  const weaknessMap = new Map(weaknesses.map(w => [w.playerId, w]));

  return squad.players.map(player => {
    const pid = player.playerId || player.id;
    const isStarter = starterIds.has(pid);
    const { replacementLoss } = calculateReplacementLoss(engine, squad, player);
    const vorpData = calculateVORP(engine, player, squad);
    const statusLower = ((player.status || '') + ' ' + (player.statusInfo || '')).toLowerCase();
    const isInjured = statusLower.includes('duda') || statusLower.includes('lesion') || statusLower.includes('baja') || statusLower.includes('rotura');
    const price = player.price || player.quotedPrice || 0;
    const weakness = weaknessMap.get(pid);

    let role = 'DEPTH';
    let roleDescription = '';

    if (player.type === 'keeper' || replacementLoss >= 8 || price >= 9000000 || vorpData.vorp >= 60) {
      role = 'CORE';
      roleDescription = `Pilar intocable (Pérdida por reemplazo: ${replacementLoss} pts, VORP: ${vorpData.vorp} pts).`;
    } else if (isStarter && weakness && weakness.upgradeGap >= 2.0) {
      role = 'UPGRADEABLE';
      roleDescription = `Titular con techo bajo / brecha de mejora de ${weakness.upgradeGap} pts. Prioridad de sustitución.`;
    } else if (isStarter) {
      role = 'STARTER';
      roleDescription = `Titular habitual solvente (Aporte XI: ${replacementLoss} pts, VORP: ${vorpData.vorp} pts).`;
    } else if (isInjured && price <= 2000000) {
      role = 'SPECULATIVE';
      roleDescription = `Activo en recuperación física o revalorización potencial.`;
    } else if (!isStarter && (vorpData.vorp < 10 || price > 3000000)) {
      role = 'SELL';
      roleDescription = `Suplente amortizable o prescindible para liberar tesorería (${price.toLocaleString()} €).`;
    } else {
      role = 'DEPTH';
      roleDescription = `Fondo de armario necesario para rotaciones y prevención de penalizaciones.`;
    }

    return {
      playerId: pid,
      name: player.name,
      position: player.type || player.position,
      price,
      role,
      roleDescription,
      isStarter,
      replacementLoss,
      vorp: vorpData.vorp,
      vorpPerMatchday: vorpData.vorpPerMatchday
    };
  });
}

// ── STAR REPLACEMENT TEST ──────────────────────────────────────────────────────

/**
 * Evaluates whether selling an elite star to acquire multiple upgrades is mathematically positive.
 * Condition: Net XI Delta >= +5.0 pts/round AND Cash Delta >= 0.
 */
export function starReplacementTest(engine, squad, starToSell, candidatesToBuy = []) {
  if (!starToSell) {
    return { shouldSell: false, netDelta: 0, cashDelta: 0, reason: 'Jugador no especificado.' };
  }

  const { replacementLoss } = calculateReplacementLoss(engine, squad, starToSell);
  const starPrice = starToSell.price || starToSell.quotedPrice || 0;

  // Evaluate candidates
  let totalMarginalGain = 0;
  let totalCandidatesCost = 0;
  const candidateDetails = [];

  // Simulate squad without star
  const squadWithoutStar = {
    ...squad,
    players: (squad.players || []).filter(p => (p.playerId || p.id) !== (starToSell.playerId || starToSell.id))
  };

  let currentSimSquad = squadWithoutStar;
  for (const candidate of candidatesToBuy) {
    const { marginalValue, entersXI } = calculateMarginalValue(engine, currentSimSquad, candidate);
    const candPrice = candidate.price || candidate.quotedPrice || 0;
    totalMarginalGain += marginalValue;
    totalCandidatesCost += candPrice;
    candidateDetails.push({
      playerId: candidate.playerId || candidate.id,
      name: candidate.name,
      marginalValue,
      entersXI,
      price: candPrice
    });
    // Add to simulation squad for subsequent candidate evaluation
    currentSimSquad = {
      ...currentSimSquad,
      players: [...(currentSimSquad.players || []), candidate]
    };
  }

  const netDelta = parseFloat((totalMarginalGain - replacementLoss).toFixed(1));
  const cashDelta = starPrice - totalCandidatesCost;

  // Strict quantitative hurdle: Net Delta >= +5.0 pts/round AND cash positive
  const shouldSell = netDelta >= 5.0 && cashDelta >= 0;

  const reason = shouldSell
    ? `✅ Venta de estrella JUSTIFICADA: La combinación de ${candidatesToBuy.length} refuerzos aporta +${netDelta} pts netos/jornada con superávit de ${cashDelta.toLocaleString()} €.`
    : `⛔ Venta de estrella RECHAZADA: Delta neto insuficiente (+${netDelta} pts < +5.0 pts) o déficit financiero (${cashDelta.toLocaleString()} €). Sacrificar a ${starToSell.name} destruye competitividad.`;

  return {
    shouldSell,
    netDelta,
    cashDelta,
    starReplacementLoss: replacementLoss,
    totalMarginalGain,
    candidateDetails,
    reason
  };
}

// ── HISTORICAL PRIOR & BAYESIAN SHRINKAGE ─────────────────────────────────────

/**
 * Calculates historical recency-weighted Prior PPM over the last 3 seasons (0.50 / 0.30 / 0.20).
 * With fallback cascade for younger / unproven players.
 *
 * @param {Object} player
 * @returns {number} Calibrated prior expected points per match
 */
export function calculateHistoricalPriorPPM(player) {
  if (!player) return 3.5;

  const historical = player.historicalPoints || player.historical || player.history || [];
  const validSeasons = (Array.isArray(historical) ? historical : [])
    .map(h => {
      if (typeof h === 'number') return { points: h, gamesPlayed: 34 };
      const pts = parseInt(h.points ?? h.totalPoints ?? 0, 10);
      const gp = parseInt(h.gamesPlayed ?? h.matches ?? h.appearances ?? 34, 10);
      return { points: pts, gamesPlayed: Math.max(15, gp) };
    })
    .filter(s => s.points > 0);

  if (validSeasons.length > 0) {
    const weights = [0.50, 0.30, 0.20];
    const recentFirst = [...validSeasons].reverse();
    let totalWeight = 0;
    let weightedSum = 0;

    for (let i = 0; i < Math.min(3, recentFirst.length); i++) {
      const season = recentFirst[i];
      const ppm = season.points / season.gamesPlayed;
      const w = weights[i];
      weightedSum += ppm * w;
      totalWeight += w;
    }

    if (totalWeight > 0) {
      return parseFloat((weightedSum / totalWeight).toFixed(2));
    }
  }

  // Fallback cascade by market value tier and position
  const price = player.price || player.quotedPrice || 0;
  if (price > 15000000) return 6.5; // Galactico
  if (price > 7000000) return 5.2;  // Star starter
  if (price > 3000000) return 4.2;  // Established starter
  if (price > 1000000) return 3.2;  // Regular rotation
  if (price > 500000) return 2.4;   // Young prospect / sub
  return 1.8;                      // Depth / fringe
}

/**
 * Empirical-Bayes Shrinkage of observed sample scores towards historical prior PPM.
 *
 * posteriorPPM = (priorWeight * historicalPriorPPM + n * recentMean) / (priorWeight + n)
 *
 * @param {Object} player
 * @param {number[]|number} sampleScores Array of recent match scores or single average
 * @param {number} priorWeight Shrinkage weight factor (default = 3)
 * @returns {{ posteriorPPM: number, sampleMean: number, priorPPM: number, sampleSize: number }}
 */
export function calculateRecencyWeightedPPM(player, sampleScores = [], priorWeight = 3) {
  const priorPPM = calculateHistoricalPriorPPM(player);
  const scores = Array.isArray(sampleScores)
    ? sampleScores.filter(s => typeof s === 'number' && !isNaN(s))
    : (typeof sampleScores === 'number' && sampleScores > 0 ? [sampleScores] : []);

  const n = scores.length;
  if (n === 0) {
    return {
      posteriorPPM: priorPPM,
      sampleMean: priorPPM,
      priorPPM,
      sampleSize: 0
    };
  }

  const sampleMean = scores.reduce((a, b) => a + b, 0) / n;
  const posteriorPPM = parseFloat((((priorWeight * priorPPM) + (n * sampleMean)) / (priorWeight + n)).toFixed(2));

  return {
    posteriorPPM,
    sampleMean: parseFloat(sampleMean.toFixed(2)),
    priorPPM,
    sampleSize: n
  };
}

// ── SEASON UTILITY ─────────────────────────────────────────────────────────────

/**
 * Dynamic time-decaying season utility function.
 * As matchday t -> 38, weight of points rises from 0.50 to 0.95 while financial asset weight drops.
 * Normalizes points and wealth dimensions onto standard [0, 100] indexes.
 */
export function calculateSeasonUtility(squadValue, points = 0, balance = 0, currentMatchday = 1, expectedXiPpm = null) {
  const totalMatchdays = 38;
  const t = Math.max(1, Math.min(totalMatchdays, currentMatchday));

  const wPts = 0.50 + 0.45 * (t / totalMatchdays);
  const wVal = 1.0 - wPts;

  const remainingMatchdays = totalMatchdays - t;

  // Normalized points score (benchmark: 1800 pts target for league title)
  const xiPpm = typeof expectedXiPpm === 'number' && expectedXiPpm > 0 ? expectedXiPpm : (squadValue > 100 ? (squadValue / 1000000) * 0.8 : squadValue);
  const projectedPoints = points + (xiPpm * (remainingMatchdays / 38));
  const pointsScore = (projectedPoints / 1800) * 100;

  // Normalized wealth score (benchmark: 55M EUR squad patrimony)
  const squadValInEUR = squadValue > 1000 ? squadValue : squadValue * 1000000;
  const totalWealthEUR = squadValInEUR + balance;
  const wealthScore = (totalWealthEUR / 55000000) * 100;

  const compositeUtility = parseFloat(((pointsScore * wPts) + (wealthScore * wVal)).toFixed(2));

  return {
    compositeUtility,
    wPts: parseFloat(wPts.toFixed(3)),
    wVal: parseFloat(wVal.toFixed(3)),
    projectedPoints: Math.round(projectedPoints),
    pointsScore: parseFloat(pointsScore.toFixed(2)),
    wealthScore: parseFloat(wealthScore.toFixed(2)),
    currentMatchday: t,
    remainingMatchdays
  };
}

// ── MAXIMUM RATIONAL BID (VALUATION ENGINE) ─────────────────────────────────────

export function calculateMaxRationalBid(candidate, purchaseScore, balance, rivalIntel = null, strategyOverride = null) {
  const strategy = strategyOverride || getStrategy();
  const marketValue = candidate.price || candidate.quotedPrice || 0;
  const rawAutoBidLimit = strategy.liquidity?.autoBidLimit ?? 8;
  const autoBidLimit = rawAutoBidLimit < 1000 ? rawAutoBidLimit * 1000000 : rawAutoBidLimit;
  const criticalPctBalance = strategy.liquidity?.criticalPurchasePctBalance || 0.40;

  const reasoning = [];
  const isComputer = isVerifiedComputerOwner(candidate);

  // 1. Dynamic Valuation & Strategic Bidding Bands
  const marginalValue = purchaseScore.marginalValue || 0;
  const ppm = purchaseScore.performance?.ppm || 0;
  const posNeedRaw = purchaseScore.components?.positionNeed?.raw || 0;
  const statusLower = ((candidate.status || '') + ' ' + (candidate.statusInfo || '')).toLowerCase();
  const isInjuredOrDoubt = statusLower.includes('duda') || statusLower.includes('lesion') || statusLower.includes('baja');

  let band = 'BASE';
  let baseMarginPct = 0;

  if (strategy.purchase?.enforceStrictZeroMargin === true) {
    baseMarginPct = 0;
    band = 'EXACT_VM';
  } else if (marginalValue >= 5.0 || (marketValue >= 12000000 && ppm >= 6.0)) {
    // Band 4: Elite / League-Winning Star (115% - 125% VM)
    band = 'ELITE_LEAGUE_WINNER';
    baseMarginPct = Math.min(25, 15 + Math.round((marginalValue - 5.0) * 2.5));
  } else if (marginalValue >= 2.5) {
    // Band 3: Clear Starting XI Upgrade (105% - 115% VM)
    band = 'CLEAR_UPGRADE';
    baseMarginPct = Math.min(15, 5 + Math.round((marginalValue - 2.5) * 4.0));
  } else if (marginalValue > 0 || posNeedRaw >= 50) {
    // Band 2: Squad Depth / Rotation (100% - 105% VM)
    band = 'DEPTH';
    baseMarginPct = Math.min(5, Math.max(0, Math.round(marginalValue * 1.5)));
  } else if (isInjuredOrDoubt || (marginalValue <= 0 && ppm >= 4.5)) {
    // Band 1: Speculation (95% - 102% VM)
    band = 'SPECULATION';
    baseMarginPct = 2;
  } else {
    // Exact market price baseline
    band = 'BASE';
    baseMarginPct = 0;
  }

  // 2. Rival Denial Bonus (Game Theoretic Defense)
  let denialBonusPct = 0;
  if (rivalIntel && isComputer) {
    if (rivalIntel.avgCommunityOverbid > 8 || rivalIntel.isLeaderNeed) {
      denialBonusPct = Math.min(3, Math.round((rivalIntel.avgCommunityOverbid || 0) * 0.2));
    }
  }

  const marginPct = !isComputer ? 0 : Math.min(25, baseMarginPct + denialBonusPct);
  const maxRationalBid = Math.round(marketValue * (1 + (marginPct / 100)));
  const recommendedBid = maxRationalBid;

  reasoning.push(`💰 [Banda: ${band}] Puja recomendada: ${recommendedBid.toLocaleString()} € (${(100 + marginPct).toFixed(1)}% VM | Sobreprecio: +${marginPct}%).`);

  // Affordability & Safety Reserve check
  const safetyReserveMin = strategy.purchase?.safetyReserveMin ?? 1000000;
  const minRequiredCash = recommendedBid + safetyReserveMin;
  const canAfford = balance >= minRequiredCash;

  if (!canAfford) {
    reasoning.push(`⛔ Fondos insuficientes: Requiere ${minRequiredCash.toLocaleString()} € (incl. reserva de seguridad de ${safetyReserveMin.toLocaleString()} €), caja actual: ${balance.toLocaleString()} €.`);
  }

  let action = 'PASS';
  if (!isComputer) {
    reasoning.push('⛔ Vendedor no verificado como Computer. No se permite puja autónoma ni recomendada.');
  } else if (!canAfford) {
    action = 'PASS';
  } else if (purchaseScore.score < 25 && marginalValue <= 0) {
    action = 'PASS';
    reasoning.push(`⛔ Puntuación estratégica insuficiente (${purchaseScore.score} < 25) y sin mejora en el XI.`);
  } else if (marginPct > 25 || recommendedBid >= autoBidLimit || recommendedBid >= (balance * criticalPctBalance)) {
    action = 'REQUIRE_CONFIRMATION';
    reasoning.push(`⚠️ Operación crítica (${recommendedBid.toLocaleString()} € >= límite ${autoBidLimit.toLocaleString()} € o 40% caja). Requiere confirmación.`);
  } else if (strategy.liquidity?.fullAutonomousMode === false) {
    action = 'REQUIRE_CONFIRMATION';
    reasoning.push(`ℹ️ Modo semi-autónomo: Requiere confirmación.`);
  } else {
    action = 'AUTO_BID';
  }

  return {
    maxRationalBid,
    recommendedBid,
    marginPct,
    band,
    action,
    canAfford,
    reasoning
  };
}

// ── EVALUATE INCOMING OFFER ───────────────────────────────────────────────────

export function evaluateIncomingOffer(engine, player, offer, squad, balance) {
  const strategy = getStrategy();
  const reasoning = [];

  const marketValue = player.quotedPrice || player.price || 0;
  const offerPrice = offer.price || 0;

  // 1. Calculate replacement loss
  const { replacementLoss, wasInXI } = calculateReplacementLoss(engine, squad, player);
  const minProtection = strategy.sale?.minReplacementLossForProtection || 10;

  reasoning.push(`📉 Pérdida por reemplazo: ${replacementLoss} pts${wasInXI ? ' (TITULAR)' : ' (suplente)'}.`);

  // 2. Core player protection with positive balance
  if (replacementLoss >= minProtection && balance >= 0) {
    reasoning.push(`🛡️ Jugador CORE: perder ${replacementLoss} pts del XI es inaceptable con saldo positivo.`);
    return {
      shouldAccept: false,
      action: 'REJECT_OFFER',
      chosenOffer: offer,
      replacementLoss,
      reasoning
    };
  }

  // 3. Ofertas por debajo de VM -> RECHAZO ESTRICTO
  if (offerPrice < marketValue) {
    reasoning.push(`⛔ Oferta (${offerPrice.toLocaleString()} €) es INFERIOR al valor de mercado (${marketValue.toLocaleString()} €). RECHAZADA.`);
    return {
      shouldAccept: false,
      action: 'REJECT_OFFER',
      chosenOffer: offer,
      replacementLoss,
      reasoning
    };
  }

  // 4. 🛡️ REGLA 1: NUNCA auto-aceptar (devolver REQUIRE_CONFIRMATION para control humano en Telegram)
  reasoning.push(`ℹ️ Oferta válida (${offerPrice.toLocaleString()} € >= VM). Requiere confirmación manual del mánager en Telegram.`);
  return {
    shouldAccept: false,
    action: 'REQUIRE_CONFIRMATION',
    chosenOffer: offer,
    replacementLoss,
    reasoning
  };
}

// ── SALE PORTFOLIO OPTIMIZATION ────────────────────────────────────────────────

/**
 * When Racing de Oslo needs cash, find the combination of players to sell
 * that generates enough cash with minimum sporting loss.
 *
 * Uses bounded combinatorial search (squad is small, max ~15 players).
 *
 * @param {ComunioEngine} engine
 * @param {{ players: Array }} squad
 * @param {number} requiredCash  Positive number: how much cash we need
 * @param {number} maxCandidates  Max players to consider selling (default 3)
 * @returns {{ suggestedSales: Array, totalCash: number, totalSportingLoss: number, reasoning: string[] }}
 */
export function evaluateSalePortfolio(engine, squad, requiredCash, maxCandidates = 3) {
  const strategy = getStrategy();
  const players = squad.players || [];
  const reasoning = [];

  if (requiredCash <= 0) {
    return { suggestedSales: [], totalCash: 0, totalSportingLoss: 0, reasoning: ['No se necesita liquidez.'] };
  }

  // Pre-compute replacement loss for each player
  const candidates = players.map(p => {
    const { replacementLoss, wasInXI } = calculateReplacementLoss(engine, squad, p);
    const price = p.price || p.quotedPrice || 0;
    // Cost efficiency: how many pts of sporting loss per million of cash generated
    const costPerMillion = price > 0 ? (replacementLoss / (price / 1000000)) : Infinity;

    return {
      ...p,
      replacementLoss,
      wasInXI,
      salePrice: price,
      costPerMillion
    };
  }).filter(p => p.salePrice > 0); // Only players with market value

  // Sort by cost efficiency: prefer selling those with lowest sporting loss per cash generated
  // Tie-break: prefer selling cheaper assets first to minimize capital liquidation
  candidates.sort((a, b) => {
    if (Math.abs(a.costPerMillion - b.costPerMillion) > 0.001) {
      return a.costPerMillion - b.costPerMillion;
    }
    return a.salePrice - b.salePrice;
  });

  // Greedy approach: pick cheapest-to-lose players until we cover the required cash
  // Then verify the combined result is acceptable
  const suggestedSales = [];
  let totalCash = 0;
  let totalSportingLoss = 0;

  for (const c of candidates) {
    if (totalCash >= requiredCash) break;
    if (suggestedSales.length >= maxCandidates) break;

    suggestedSales.push({
      playerId: c.playerId || c.id,
      name: c.name,
      type: c.type,
      salePrice: c.salePrice,
      replacementLoss: c.replacementLoss,
      wasInXI: c.wasInXI,
      reason: c.wasInXI
        ? `Titular con impacto de ${c.replacementLoss} pts. Sacrificio necesario.`
        : `Suplente/descarte. Liberación de ${c.salePrice.toLocaleString()} € con mínimo impacto deportivo (${c.replacementLoss} pts).`
    });
    totalCash += c.salePrice;
    totalSportingLoss += c.replacementLoss;
  }

  // Check if we could improve by swapping: try all pairs if greedy result sells a core player
  if (suggestedSales.length <= 2 && candidates.length >= 3) {
    // Try alternative: two cheapest non-core players vs one expensive core player
    for (let i = 0; i < Math.min(candidates.length, 6); i++) {
      for (let j = i + 1; j < Math.min(candidates.length, 6); j++) {
        const pairCash = candidates[i].salePrice + candidates[j].salePrice;
        const pairLoss = candidates[i].replacementLoss + candidates[j].replacementLoss;
        if (pairCash >= requiredCash && pairLoss < totalSportingLoss) {
          // Better combination found
          suggestedSales.length = 0;
          suggestedSales.push(
            { playerId: candidates[i].playerId || candidates[i].id, name: candidates[i].name, type: candidates[i].type, salePrice: candidates[i].salePrice, replacementLoss: candidates[i].replacementLoss, wasInXI: candidates[i].wasInXI, reason: `Venta combinada con menor impacto deportivo.` },
            { playerId: candidates[j].playerId || candidates[j].id, name: candidates[j].name, type: candidates[j].type, salePrice: candidates[j].salePrice, replacementLoss: candidates[j].replacementLoss, wasInXI: candidates[j].wasInXI, reason: `Venta combinada con menor impacto deportivo.` }
          );
          totalCash = pairCash;
          totalSportingLoss = pairLoss;
        }
      }
    }
  }

  if (totalCash >= requiredCash) {
    reasoning.push(`✅ Se cubren ${requiredCash.toLocaleString()} € vendiendo ${suggestedSales.length} jugador(es) con pérdida deportiva de ${totalSportingLoss} pts.`);
  } else {
    reasoning.push(`⚠️ Solo se generan ${totalCash.toLocaleString()} € de ${requiredCash.toLocaleString()} € necesarios.`);
  }

  return { suggestedSales, totalCash, totalSportingLoss, reasoning };
}

// ── POST-SIGNING SALE EVALUATION ───────────────────────────────────────────────

/**
 * After signing a new player, decide IF a sale makes sense and WHO to sell.
 *
 * Compares three squad states:
 *   before:        bestXI(currentSquad)
 *   afterSigning:  bestXI(currentSquad + newSigning)
 *   afterSale:     bestXI(currentSquad + newSigning - saleCandidate)
 *
 * Only recommends a sale if:
 *   1. Squad is at capacity (>= 15 players)
 *   2. The sale does not significantly degrade the XI vs afterSigning
 *   3. The freed cash is meaningful
 *
 * @param {ComunioEngine} engine
 * @param {Object} newSigning
 * @param {{ players: Array }} squad
 * @param {number} balance
 * @returns {{ shouldSell: boolean, saleCandidate: Object|null, reason: string, squadValues: Object }}
 */
export function evaluatePostSigningSale(engine, newSigning, squad, balance) {
  const currentPlayers = squad.players || [];
  const isSquadFull = currentPlayers.length >= 15;

  const beforeValue = calculateSquadValue(engine, squad);

  // Squad with new signing
  const afterSquad = { ...squad, players: [...currentPlayers, newSigning] };
  const afterValue = calculateSquadValue(engine, afterSquad);

  if (!isSquadFull && balance >= 0) {
    return {
      shouldSell: false,
      saleCandidate: null,
      reason: `Plantilla no está llena (${currentPlayers.length}/15) y saldo positivo. Se mantiene a todos.`,
      squadValues: { before: beforeValue, afterSigning: afterValue }
    };
  }

  // Evaluate each player as potential sale candidate
  const afterPlayers = afterSquad.players;
  let bestCandidate = null;
  let bestCandidateScore = -Infinity; // Higher = better sale choice
  let bestAfterSaleValue = 0;

  for (const p of afterPlayers) {
    const pid = p.playerId || p.id;
    // Don't sell the player we just signed
    if (pid === (newSigning.playerId || newSigning.id)) continue;

    const withoutPlayer = afterPlayers.filter(pp => (pp.playerId || pp.id) !== pid);
    const afterSaleSquad = { ...squad, players: withoutPlayer };
    const afterSaleValue = calculateSquadValue(engine, afterSaleSquad);

    const sportingLoss = afterValue - afterSaleValue;
    const cashGained = p.price || 0;
    // Score: maximize cash gained while minimizing sporting loss
    const saleScore = (cashGained / 1000000) - (sportingLoss * 0.5);

    if (saleScore > bestCandidateScore) {
      bestCandidateScore = saleScore;
      bestCandidate = p;
      bestAfterSaleValue = afterSaleValue;
    }
  }

  // Only sell if the squad after sale is still at least as good as before the signing
  if (bestCandidate && bestAfterSaleValue >= beforeValue) {
    return {
      shouldSell: true,
      saleCandidate: bestCandidate,
      reason: `💰 Venta recomendada: ${bestCandidate.name} (${(bestCandidate.price || 0).toLocaleString()} €). XI tras venta (${bestAfterSaleValue} pts) >= XI antes del fichaje (${beforeValue} pts).`,
      squadValues: { before: beforeValue, afterSigning: afterValue, afterSale: bestAfterSaleValue }
    };
  }

  if (isSquadFull && bestCandidate) {
    // Squad is full, we must sell someone
    return {
      shouldSell: true,
      saleCandidate: bestCandidate,
      reason: `⚠️ Plantilla llena (15/15). Venta forzada de ${bestCandidate.name} (menor impacto deportivo).`,
      squadValues: { before: beforeValue, afterSigning: afterValue, afterSale: bestAfterSaleValue }
    };
  }

  return {
    shouldSell: false,
    saleCandidate: null,
    reason: `No se recomienda venta: todos los jugadores contribuyen significativamente al XI.`,
    squadValues: { before: beforeValue, afterSigning: afterValue }
  };
}
