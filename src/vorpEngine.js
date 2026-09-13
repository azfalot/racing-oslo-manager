/**
 * VORP Engine — Calibrated Value Over Replacement Player & Positional Weakness Analyzer
 *
 * Provides calibrated quantitative metrics:
 * 1. Dynamic league-derived replacement level by position (P35 percentile from market/pool)
 * 2. Value Over Replacement Player (VORP) for candidates and squad members
 * 3. Top Positional Weaknesses in the current starting XI
 * 4. Squad depth fragility penalty for squads running <= 11 players
 */

export const STATIC_REPLACEMENT_PPM = {
  keeper: 2.5,
  defender: 2.0,
  midfielder: 2.2,
  striker: 2.5
};

/**
 * Calculates dynamic league-derived replacement level baseline for a position.
 * Uses P35 percentile of accessible low-cost players (<= 2.0M EUR) with active minutes/points.
 * Blends with static prior when empirical sample size is small.
 *
 * @param {ComunioEngine} engine
 * @param {Object} squad
 * @param {string} position 'keeper' | 'defender' | 'midfielder' | 'striker'
 * @param {Array} marketPool Optional pool of available market players
 * @returns {{ position: string, replacementPpm: number, sampleSize: number, confidence: string, source: string, replacementSeasonPoints: number, baselinePpm: number }}
 */
export function calculateReplacementLevel(engine, squad, position, marketPool = []) {
  const basePpm = STATIC_REPLACEMENT_PPM[position] || 2.0;
  const matchdays = 34;

  // 1. Gather active low-cost pool in this position from market and squad
  const combinedCandidates = [
    ...(squad?.players || []),
    ...(Array.isArray(marketPool) ? marketPool : [])
  ].filter(p => {
    const pos = p.type || p.position;
    const price = p.price || p.quotedPrice || 0;
    return pos === position && price <= 2500000;
  });

  // Filter out obvious non-playing assets (0 pts, inactive or suspended)
  const validPool = combinedCandidates
    .map(p => {
      const avg = parseFloat(p.average?.points ? String(p.average.points).replace(',', '.') : 0);
      const proj = engine?.getExpectedPoints ? engine.getExpectedPoints(p) : 0;
      const effective = avg > 0 ? avg : (proj > 0 ? proj : 0);
      return effective;
    })
    .filter(val => val > 0.5);

  let replacementPpm = basePpm;
  let source = 'STATIC_PRIOR';
  let confidence = 'LOW';
  const sampleSize = validPool.length;

  if (sampleSize >= 5) {
    validPool.sort((a, b) => a - b);
    // P35 percentile index
    const p35Index = Math.floor(sampleSize * 0.35);
    const empiricalP35 = validPool[p35Index] || basePpm;

    if (sampleSize >= 15) {
      replacementPpm = empiricalP35;
      source = 'MARKET_P35';
      confidence = 'HIGH';
    } else {
      // Empirical-Bayes blend with static prior
      const priorWeight = 5;
      replacementPpm = ((sampleSize * empiricalP35) + (priorWeight * basePpm)) / (sampleSize + priorWeight);
      source = 'HYBRID_P35';
      confidence = 'MEDIUM';
    }
  } else if (sampleSize > 0) {
    const meanPool = validPool.reduce((a, b) => a + b, 0) / sampleSize;
    replacementPpm = ((sampleSize * meanPool) + (5 * basePpm)) / (sampleSize + 5);
    source = 'HYBRID_P35';
    confidence = 'LOW';
  }

  const effectiveReplacementPpm = parseFloat(replacementPpm.toFixed(2));
  const effectiveSeasonPoints = Math.round(effectiveReplacementPpm * matchdays);

  return {
    position,
    replacementPpm: effectiveReplacementPpm,
    replacementSeasonPoints: effectiveSeasonPoints,
    sampleSize,
    confidence,
    source,
    baselinePpm: basePpm,
    baselineSeasonPoints: Math.round(basePpm * matchdays)
  };
}

/**
 * Calculates Value Over Replacement Player (VORP) for a candidate or squad player.
 *
 *   VORP = ExpectedSeasonPoints(player) - ExpectedSeasonPoints(ReplacementLevel)
 */
export function calculateVORP(engine, player, squad = null, marketPool = []) {
  if (!player) {
    return {
      vorp: 0,
      vorpPerMatchday: 0,
      vorpPerMillion: 0,
      seasonPoints: 0,
      replacementPoints: 0,
      replacementSource: 'STATIC_PRIOR'
    };
  }

  const pos = player.type || player.position || 'midfielder';
  const replLevel = calculateReplacementLevel(engine, squad, pos, marketPool);

  const seasonPoints = engine?.getSeasonProjection ? engine.getSeasonProjection(player) : 80;
  const vorp = seasonPoints - replLevel.replacementSeasonPoints;
  const vorpPerMatchday = parseFloat((vorp / 34).toFixed(2));

  const priceInM = Math.max(0.1, (player.price || player.quotedPrice || 500000) / 1000000);
  const vorpPerMillion = parseFloat((vorp / priceInM).toFixed(1));

  const sampleSize = Array.isArray(player.lastMatches) ? player.lastMatches.length : (player.historicalPoints?.length || 0);
  const confidenceLevel = sampleSize >= 10 ? 'HIGH' : sampleSize >= 4 ? 'MEDIUM' : 'LOW';

  return {
    playerId: player.playerId || player.id,
    name: player.name,
    position: pos,
    seasonPoints,
    replacementSeasonPoints: replLevel.replacementSeasonPoints,
    replacementPpm: replLevel.replacementPpm,
    replacementSource: replLevel.source,
    replacementConfidence: replLevel.confidence,
    confidenceLevel,
    sampleSize,
    vorp,
    vorpPerMatchday,
    vorpPerMillion,
    priceInM
  };
}

/**
 * Computes dynamic P35 replacement baseline per standard position from a pool of players.
 */
export function calculateDynamicReplacementLevels(playerPool = [], percentile = 0.35) {
  const positions = ['por', 'def', 'mid', 'del'];
  const posMapping = {
    por: 'keeper',
    def: 'defender',
    mid: 'midfielder',
    del: 'striker',
    keeper: 'keeper',
    defender: 'defender',
    midfielder: 'midfielder',
    striker: 'striker'
  };

  const results = {
    por: { points: 68, ppm: 2.0 },
    def: { points: 68, ppm: 2.0 },
    mid: { points: 75, ppm: 2.2 },
    del: { points: 85, ppm: 2.5 }
  };

  positions.forEach(pos => {
    const matching = (playerPool || []).filter(p => {
      const pPos = p.position || p.type;
      return pPos === pos || posMapping[pPos] === posMapping[pos] || posMapping[pPos] === pos;
    });

    if (matching.length > 0) {
      const scores = matching
        .map(p => p.points || (p.average?.points ? p.average.points * 34 : 0))
        .filter(pts => pts > 0)
        .sort((a, b) => a - b);

      if (scores.length > 0) {
        const idx = Math.min(scores.length - 1, Math.floor(scores.length * percentile));
        const val = scores[idx];
        results[pos] = {
          points: val,
          ppm: parseFloat((val / 34).toFixed(2))
        };
      }
    }
  });

  return results;
}

/**
 * Identifies the Top Positional Weaknesses in the squad's optimal Starting XI.
 * Focuses on starters with the lowest VORP or lowest Expected Points where
 * a market upgrade would produce the highest Expected XI Delta.
 */
export function identifyPositionalWeaknesses(engine, squad, marketPool = []) {
  if (!squad || !squad.players || squad.players.length === 0) {
    return [];
  }

  const lineup = engine.optimizeLineup(squad);
  const starters = lineup.starting11 || [];

  const starterAnalysis = starters.map(starter => {
    const fullPlayer = (squad.players || []).find(
      p => (p.playerId || p.id) === (starter.playerId || starter.id)
    ) || starter;

    const expPoints = starter.expectedPoints || engine.getExpectedPoints(fullPlayer);
    const vorpData = calculateVORP(engine, fullPlayer, squad, marketPool);
    
    // Benchmark target for championship contender starter: 5.5 pts/matchday
    const benchmarkTarget = 5.5;
    const upgradeGap = Math.max(0, parseFloat((benchmarkTarget - expPoints).toFixed(1)));

    return {
      playerId: fullPlayer.playerId || fullPlayer.id,
      name: fullPlayer.name,
      position: fullPlayer.type || fullPlayer.position,
      price: fullPlayer.price || fullPlayer.quotedPrice || 0,
      expectedPoints: expPoints,
      vorp: vorpData.vorp,
      vorpPerMatchday: vorpData.vorpPerMatchday,
      replacementPpm: vorpData.replacementPpm,
      upgradeGap,
      urgencyScore: parseFloat(((upgradeGap * 0.7) + (Math.max(0, 50 - vorpData.vorp) * 0.3)).toFixed(1))
    };
  });

  // Sort by urgency of upgrade (lowest expected points / highest upgrade gap first)
  starterAnalysis.sort((a, b) => b.urgencyScore - a.urgencyScore);

  return starterAnalysis;
}

/**
 * Calculates depth fragility penalty for running an undersized squad.
 * Target squad size: 13-14 players (11 starters + 2-3 economical rotation pieces).
 */
export function calculateDepthFragility(squad) {
  const players = squad?.players || [];
  const squadSize = players.length;
  const targetSize = 13;

  const isFragile = squadSize <= 11;
  const missingDepthCount = Math.max(0, targetSize - squadSize);

  // Fragility penalty in points per matchday due to risk of 0-pt penalty (-4) upon single injury
  // Probability of at least 1 starter missing a match in any given matchday is ~25-35%
  const injuryRiskRate = 0.28;
  const emptySlotPenalty = 4.0;
  const depthPenaltyPerMatchday = isFragile ? parseFloat((injuryRiskRate * emptySlotPenalty).toFixed(2)) : 0;

  return {
    squadSize,
    targetSize,
    isFragile,
    missingDepthCount,
    depthPenaltyPerMatchday,
    recommendation: isFragile
      ? `🚨 Plantilla frágil (${squadSize} jugadores). Sin suplentes: cualquier baja imprevista costará -4 pts por hueco vacío. Priorizar 2 suplentes económicos (160k-400k €).`
      : `✅ Profundidad adecuada (${squadSize} jugadores). Cobertura activa ante rotaciones y bajas.`
  };
}
