/**
 * Squad Optimizer — Pure-function module for squad-level decision making.
 *
 * Every function in this module is deterministic and side-effect-free.
 * It depends on ComunioEngine for lineup optimization but never calls
 * external APIs, writes files, or sends messages.
 */

import fs from 'fs';
import { evaluateClubCompetition } from './clubCompetition.js';

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
    maxBidOverMarketPct: 15.0,
    safetyReservePct: 0.15,
    safetyReserveMin: 1000000
  },
  sale: {
    minReplacementLossForProtection: 10,
    maxAssetLossPctInDebt: 0.25,
    autoAcceptAboveMarketPct: 1.10
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
 * How much adding `candidate` improves the best XI.
 *
 *   marginalValue = bestXI(squad + candidate) - bestXI(squad)
 *
 * Returns 0 if the candidate does not enter the optimal lineup.
 *
 * @param {ComunioEngine} engine
 * @param {{ players: Array }} squad
 * @param {Object} candidate  Market player object
 * @returns {{ marginalValue: number, entersXI: boolean, currentSquadValue: number, newSquadValue: number }}
 */
export function calculateMarginalValue(engine, squad, candidate) {
  const currentValue = calculateSquadValue(engine, squad);

  // Build hypothetical squad with candidate added
  const hypotheticalPlayers = [...(squad.players || []), candidate];
  const hypotheticalSquad = { ...squad, players: hypotheticalPlayers };
  const newLineup = engine.optimizeLineup(hypotheticalSquad);
  const newValue = newLineup.score || 0;

  const marginalValue = newValue - currentValue;
  const entersXI = (newLineup.starting11 || []).some(
    p => (p.playerId || p.id) === (candidate.playerId || candidate.id)
  );

  return { marginalValue, entersXI, currentSquadValue: currentValue, newSquadValue: newValue };
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

  // 1. Season PPM from current average
  const avgPoints = parseFloat(
    player.average?.points ? String(player.average.points).replace(',', '.') : '0'
  );
  const seasonPPM = (!isNaN(avgPoints) && avgPoints > 0) ? avgPoints : 0;

  // 2. Historical baseline PPM (best season / 38)
  const historyList = Array.isArray(player.historical)
    ? player.historical
    : (player.historical?.points || player.historicalPoints || []);
  const validPoints = historyList.map(h => parseInt(h.points) || 0).filter(p => p > 0);
  const bestHistorical = validPoints.length > 0 ? Math.max(...validPoints) : 0;
  const historicalPPM = bestHistorical / totalMatchdays;

  // 3. Weighted PPM: prefer season data when enough matches played, lean on historical early
  const seasonWeight = Math.min(0.70, matchdaysPlayed / totalMatchdays * 1.5);
  const historicalWeight = 1 - seasonWeight;

  let effectivePPM;
  if (seasonPPM > 0 && historicalPPM > 0) {
    effectivePPM = (seasonPPM * seasonWeight) + (historicalPPM * historicalWeight);
  } else if (seasonPPM > 0) {
    effectivePPM = seasonPPM;
  } else if (historicalPPM > 0) {
    effectivePPM = historicalPPM;
  } else {
    // Price-based fallback PPM
    const price = player.price || 0;
    if (price > 5000000) effectivePPM = 4.5;
    else if (price > 2000000) effectivePPM = 3.5;
    else if (price > 1000000) effectivePPM = 2.5;
    else effectivePPM = 1.5;
  }

  // 4. Recent form adjustment
  const recentScores = player.lastMatches || player.recentScores || [];
  let recentForm = effectivePPM;
  if (Array.isArray(recentScores) && recentScores.length > 0) {
    recentForm = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    // Blend: 40% recent form, 60% effective PPM
    effectivePPM = (recentForm * 0.40) + (effectivePPM * 0.60);
  }

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

  effectivePPM *= competitionMultiplier;
  const expectedRemainingPoints = effectivePPM * matchdaysRemaining;

  // 7. Economic efficiency: expected remaining points per million
  const priceInM = Math.max(0.1, (player.price || 100000) / 1000000);
  const efficiency = expectedRemainingPoints / priceInM;

  // 8. Starter Status Classification (Minutos y probabilidad de titularidad en equipo real)
  let starterStatus = 'ROTACION_HABITUAL';
  let starterTag = '🔄 Rotación Habitual';
  let starterProbability = (competition.confidencePct / 100);

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
    competition
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
  const isComputer = candidate.owner?.id === 1 || (candidate.owner?.name || '').toLowerCase() === 'computer';

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
  const { marginalValue, entersXI } = calculateMarginalValue(engine, squad, candidate);
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
  if (entersXI) {
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
    marginalValue
  };
}

// ── MAXIMUM RATIONAL BID ───────────────────────────────────────────────────────

/**
 * Determines the maximum price Racing de Oslo should rationally pay.
 *
 * Separates sporting value from financial feasibility.
 *
 * @param {Object} candidate
 * @param {{ score: number, components: Object, performance: Object }} purchaseScore
 * @param {number} balance  Current cash balance
 * @param {Object|null} rivalIntel
 * @returns {{ maxRationalBid: number, recommendedBid: number, marginPct: number, action: string, canAfford: boolean, reasoning: string[] }}
 */
export function calculateMaxRationalBid(candidate, purchaseScore, balance, rivalIntel = null, strategyOverride = null) {
  const strategy = strategyOverride || getStrategy();
  const marketValue = candidate.price || 0;
  const maxOverMarketPct = strategy.purchase?.maxBidOverMarketPct || 15.0;
  const safetyReservePct = strategy.purchase?.safetyReservePct || 0.15;
  const safetyReserveMin = strategy.purchase?.safetyReserveMin || 1000000;
  const rawAutoBidLimit = strategy.liquidity?.autoBidLimit ?? 8;
  const autoBidLimit = rawAutoBidLimit < 1000 ? rawAutoBidLimit * 1000000 : rawAutoBidLimit;
  const criticalPctBalance = strategy.liquidity?.criticalPurchasePctBalance || 0.40;

  const reasoning = [];
  const isComputer = candidate.owner?.id === 1 || (candidate.owner?.name || '').toLowerCase() === 'computer';

  // 1. Sporting value -> margin percentage
  // Strategic score typically 0-60. Map to 0% - maxOverMarketPct%
  const normalizedScore = Math.max(0, Math.min(60, purchaseScore.score));
  let sportingMarginPct = (normalizedScore / 60) * maxOverMarketPct;

  // 🛡️ REGLA RIVAL HUMANO: Si el jugador pertenece a un rival humano, NO sobrepagar margen extra
  if (!isComputer) {
    sportingMarginPct = 0;
    reasoning.push(`🛡️ Vendedor rival (${candidate.owner?.name || 'Manager'}): Puja ajustada exactamente a VM para no financiar a un competidor directo.`);
  }

  // 2. Rival pressure adjustment (solo frente a la Computadora)
  if (rivalIntel && isComputer) {
    const avgOverbid = rivalIntel.avgCommunityOverbid || 5;
    if (sportingMarginPct < avgOverbid && purchaseScore.score > 25) {
      sportingMarginPct = Math.min(maxOverMarketPct, avgOverbid + 1.0);
      reasoning.push(`📊 Margen ajustado para superar sobrepuja rival media (+${avgOverbid.toFixed(1)}%).`);
    }
  }

  const maxRationalBid = Math.ceil(marketValue * (1 + sportingMarginPct / 100));

  // 3. Estimate expected winning bid (when history exists)
  let expectedWinningBid = Math.ceil(marketValue * 1.05); // Default +5%
  if (rivalIntel?.avgCommunityOverbid) {
    expectedWinningBid = Math.ceil(marketValue * (1 + rivalIntel.avgCommunityOverbid / 100));
  }

  // 4. Decision: bid only if expected winning bid <= max rational bid
  let recommendedBid;
  if (expectedWinningBid <= maxRationalBid) {
    // Bid slightly above expected winning to increase chances
    recommendedBid = Math.min(maxRationalBid, Math.ceil(expectedWinningBid * 1.02));
    reasoning.push(`💰 Puja recomendada: ${recommendedBid.toLocaleString()} € (esperable ganar con +${sportingMarginPct.toFixed(1)}%).`);
  } else {
    // Would need to overpay beyond rational limit
    recommendedBid = maxRationalBid;
    reasoning.push(`⚠️ Puja esperada para ganar (${expectedWinningBid.toLocaleString()} €) supera el máximo racional (${maxRationalBid.toLocaleString()} €).`);
  }

  // 5. Financial feasibility (does NOT change the sporting value)
  const safetyReserve = Math.max(safetyReserveMin, Math.round(balance * safetyReservePct));
  const maxAffordable = balance - safetyReserve;
  const canAfford = recommendedBid <= maxAffordable;

  if (!canAfford && balance > 0) {
    reasoning.push(`🏦 No se puede permitir: Puja (${recommendedBid.toLocaleString()} €) > Disponible (${maxAffordable.toLocaleString()} €) tras reserva de seguridad.`);
    // For high-value strategic opportunities, check if we can afford at market value at least
    if (marketValue <= maxAffordable) {
      recommendedBid = marketValue; // Bid at market value minimum
      reasoning.push(`💡 Se ajusta a precio de mercado (${marketValue.toLocaleString()} €) para no perder la oportunidad.`);
    }
  }

  // 6. Determine final action
  let action = purchaseScore.action;
  const isFullAutonomous = strategy.liquidity?.fullAutonomousMode === true;

  if (action === 'PASS') {
    // Already determined by strategic score
  } else if (!canAfford && marketValue > maxAffordable) {
    action = 'PASS';
    reasoning.push(`⛔ PASS: No hay liquidez suficiente.`);
  } else if (isFullAutonomous) {
    action = 'AUTO_BID';
    reasoning.push(`🤖 AUTO_BID: Operación 100% autónoma ejecutada sin requerir confirmación.`);
  } else if (recommendedBid >= autoBidLimit || recommendedBid >= (balance * criticalPctBalance)) {
    action = 'REQUIRE_CONFIRMATION';
    reasoning.push(`⚠️ Operación CRÍTICA: Requiere confirmación manual en Telegram.`);
  } else {
    action = 'AUTO_BID';
    reasoning.push(`✅ AUTO_BID: Operación estándar dentro de límites.`);
  }

  const marginPct = marketValue > 0 ? parseFloat(((recommendedBid / marketValue - 1) * 100).toFixed(1)) : 0;

  return {
    maxRationalBid,
    recommendedBid,
    marginPct,
    expectedWinningBid,
    action,
    canAfford,
    safetyReserve,
    reasoning
  };
}

// ── SALE: INCOMING OFFER EVALUATION ────────────────────────────────────────────

/**
 * Evaluates an incoming sale offer using replacement loss.
 *
 * @param {ComunioEngine} engine
 * @param {Object} player     Our squad player being offered for
 * @param {Object} offer      { price, user: { id, name } }
 * @param {{ players: Array }} squad
 * @param {number} balance
 * @returns {{ shouldAccept: boolean, action: string, reasoning: string[] }}
 */
export function evaluateIncomingOffer(engine, player, offer, squad, balance) {
  const strategy = getStrategy();
  const reasoning = [];

  const marketValue = player.quotedPrice || player.price || 0;
  const offerPrice = offer.price || 0;
  const offerPctOfMV = marketValue > 0 ? (offerPrice / marketValue) : 1;

  // 1. Calculate replacement loss
  const { replacementLoss, wasInXI } = calculateReplacementLoss(engine, squad, player);
  const minProtection = strategy.sale?.minReplacementLossForProtection || 10;
  const autoAcceptPct = strategy.sale?.autoAcceptAboveMarketPct || 1.10;
  const maxAssetLoss = strategy.sale?.maxAssetLossPctInDebt || 0.25;

  reasoning.push(`📉 Pérdida por reemplazo: ${replacementLoss} pts${wasInXI ? ' (TITULAR)' : ' (suplente)'}.`);

  // 2. Core player protection — based on squad impact, NOT absolute points
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

  // 3. Debt handling — NUNCA aceptar por debajo del 100% del valor de mercado (0% pérdidas permitidas)
  if (balance < 0) {
    const requiredCash = Math.abs(balance);
    const assetLoss = marketValue - offerPrice;

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

    // If core player: escalate to manual confirmation even in debt (or auto-accept if fullAutonomousMode)
    if (replacementLoss >= minProtection) {
      if (strategy.liquidity?.fullAutonomousMode === true) {
        reasoning.push(`🤖 Modo 100% Autónomo: Venta aceptada automáticamente para sanear balance y evitar sanción de 0 puntos.`);
        return {
          shouldAccept: true,
          action: 'ACCEPT_OFFER',
          chosenOffer: offer,
          replacementLoss,
          reasoning
        };
      }
      reasoning.push(`⚠️ Jugador CORE con deuda. Se requiere confirmación manual.`);
      return {
        shouldAccept: false,
        action: 'REQUIRE_CONFIRMATION',
        chosenOffer: offer,
        replacementLoss,
        reasoning
      };
    }

    // Non-core player, acceptable price, in debt → accept
    reasoning.push(`💸 Saldo negativo (${balance.toLocaleString()} €). Oferta aceptable para liquidez.`);
    return {
      shouldAccept: true,
      action: 'ACCEPT_OFFER',
      chosenOffer: offer,
      replacementLoss,
      reasoning
    };
  }

  // 4. Con saldo positivo (superávit de liquidez): POLÍTICA DE PROTECCIÓN & REVALORIZACIÓN
  // Se retiene a los jugadores del banquillo para especular con su subida de cotización en los siguientes partidos.
  // Solo se acepta venta si la oferta trae prima/plusvalía clara (>= autoAcceptPct de VM, ej. >= 105%).
  if (balance >= 0) {
    if (offerPctOfMV >= autoAcceptPct) {
      reasoning.push(`✅ Oferta (${offerPrice.toLocaleString()} €) supera el ${(autoAcceptPct * 100).toFixed(0)}% del VM. Venta con plusvalía aceptada.`);
      return {
        shouldAccept: true,
        action: 'ACCEPT_OFFER',
        chosenOffer: offer,
        replacementLoss,
        reasoning
      };
    }

    reasoning.push(`🛡️ Política de Revalorización: Con saldo positivo (+${balance.toLocaleString()} €), se retiene a ${player.name} para especular con su revalorización y subida de cotización. Oferta (${offerPrice.toLocaleString()} €) sin prima suficiente.`);
    return {
      shouldAccept: false,
      action: 'REJECT_OFFER',
      chosenOffer: offer,
      replacementLoss,
      reasoning
    };
  }

  // 5. Normal conditions (deuda o necesidad): aceptar si oferta es justa
  if (offerPctOfMV >= 0.95) {
    reasoning.push(`💸 Venta aceptada por necesidad de liquidez/saneamiento.`);
    return {
      shouldAccept: true,
      action: 'ACCEPT_OFFER',
      chosenOffer: offer,
      replacementLoss,
      reasoning
    };
  }
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
