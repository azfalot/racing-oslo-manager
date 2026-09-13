/**
 * VORP Engine — Value Over Replacement Player & Positional Weakness Analyzer
 *
 * Provides quantitative metrics to evaluate:
 * 1. Replacement level by position (keeper, defender, midfielder, striker)
 * 2. Value Over Replacement Player (VORP) for candidates and squad members
 * 3. Top Positional Weaknesses in the current starting XI
 * 4. Squad depth fragility penalty for squads running <= 11 players
 */

export const BASELINE_REPLACEMENT_PPM = {
  keeper: 2.5,
  defender: 2.0,
  midfielder: 2.2,
  striker: 2.5
};

/**
 * Calculates the replacement level baseline for a position.
 * Takes into account both universal budget baseline (160k-500k players)
 * and the actual squad's lower tier.
 */
export function calculateReplacementLevel(engine, squad, position) {
  const basePpm = BASELINE_REPLACEMENT_PPM[position] || 2.0;
  const matchdays = 34;
  const baselineSeasonPoints = Math.round(basePpm * matchdays);

  const posPlayers = (squad?.players || []).filter(
    p => (p.type || p.position) === position
  );

  let squadLowestPpm = basePpm;
  if (posPlayers.length > 0) {
    const ppms = posPlayers.map(p => {
      const avg = parseFloat(p.average?.points ? String(p.average.points).replace(',', '.') : 0);
      return !isNaN(avg) && avg > 0 ? avg : basePpm;
    });
    squadLowestPpm = Math.min(...ppms);
  }

  const effectiveReplacementPpm = parseFloat(((basePpm * 0.6) + (squadLowestPpm * 0.4)).toFixed(2));
  const effectiveSeasonPoints = Math.round(effectiveReplacementPpm * matchdays);

  return {
    position,
    replacementPpm: effectiveReplacementPpm,
    replacementSeasonPoints: effectiveSeasonPoints,
    baselinePpm: basePpm,
    baselineSeasonPoints
  };
}

/**
 * Calculates Value Over Replacement Player (VORP) for a candidate or squad player.
 *
 *   VORP = ExpectedSeasonPoints(player) - ExpectedSeasonPoints(ReplacementLevel)
 */
export function calculateVORP(engine, player, squad = null) {
  if (!player) {
    return { vorp: 0, vorpPerMatchday: 0, vorpPerMillion: 0, seasonPoints: 0, replacementPoints: 0 };
  }

  const pos = player.type || player.position || 'midfielder';
  const replLevel = calculateReplacementLevel(engine, squad, pos);

  const seasonPoints = engine.getSeasonProjection ? engine.getSeasonProjection(player) : 80;
  const vorp = seasonPoints - replLevel.replacementSeasonPoints;
  const vorpPerMatchday = parseFloat((vorp / 34).toFixed(2));

  const priceInM = Math.max(0.1, (player.price || player.quotedPrice || 500000) / 1000000);
  const vorpPerMillion = parseFloat((vorp / priceInM).toFixed(1));

  return {
    playerId: player.playerId || player.id,
    name: player.name,
    position: pos,
    seasonPoints,
    replacementSeasonPoints: replLevel.replacementSeasonPoints,
    vorp,
    vorpPerMatchday,
    vorpPerMillion,
    priceInM
  };
}

/**
 * Identifies the Top Positional Weaknesses in the squad's optimal Starting XI.
 * Focuses on starters with the lowest VORP or lowest Expected Points where
 * a market upgrade would produce the highest Expected XI Delta.
 */
export function identifyPositionalWeaknesses(engine, squad) {
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
    const vorpData = calculateVORP(engine, fullPlayer, squad);
    
    // Gap to a high-performance starter benchmark (e.g. 5.5 pts/matchday)
    const benchmarkTarget = 5.5;
    const upgradeGap = Math.max(0, benchmarkTarget - expPoints);

    return {
      playerId: fullPlayer.playerId || fullPlayer.id,
      name: fullPlayer.name,
      position: fullPlayer.type || fullPlayer.position,
      price: fullPlayer.price || fullPlayer.quotedPrice || 0,
      expectedPoints: expPoints,
      vorp: vorpData.vorp,
      vorpPerMatchday: vorpData.vorpPerMatchday,
      upgradeGap: parseFloat(upgradeGap.toFixed(1)),
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
