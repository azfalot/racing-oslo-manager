import fs from 'fs';
import path from 'path';

export function auditBenchPerformance(squadPlayers = [], startingIds = []) {
  const startersSet = new Set(Array.isArray(startingIds) ? startingIds.map(id => parseInt(id)) : startingIds);
  const starters = [];
  const bench = [];

  for (const p of squadPlayers) {
    const pid = parseInt(p.playerId || p.id);
    const pts = typeof p.lastPoints === 'number' ? p.lastPoints : (p.points || 0);
    const item = {
      id: pid,
      name: p.name,
      position: p.position || p.type,
      clubName: p.clubName || 'LaLiga',
      price: p.price || 0,
      points: pts,
      isStarter: startersSet.has(pid)
    };

    if (startersSet.has(pid)) {
      starters.push(item);
    } else {
      bench.push(item);
    }
  }

  const starterPoints = starters.reduce((sum, p) => sum + p.points, 0);
  const benchPoints = bench.reduce((sum, p) => sum + p.points, 0);

  bench.sort((a, b) => b.points - a.points);

  const missedOpportunities = [];
  for (const b of bench) {
    if (b.points <= 0) continue;
    const inferiorStarters = starters.filter(s => s.points < b.points);
    if (inferiorStarters.length > 0) {
      inferiorStarters.sort((a, b) => a.points - b.points);
      missedOpportunities.push({
        benchPlayer: b,
        lowestStarter: inferiorStarters[0],
        pointsDiff: b.points - inferiorStarters[0].points
      });
    }
  }

  return {
    starterPoints,
    benchPoints,
    totalSquadPoints: starterPoints + benchPoints,
    startersCount: starters.length,
    benchCount: bench.length,
    starters,
    bench,
    missedOpportunities,
    topBenchPerformer: bench.length > 0 && bench[0].points > 0 ? bench[0] : null
  };
}

export function calculateOptimalHindsight11(squadPlayers = []) {
  const getPos = p => (p.position || p.type || '').toLowerCase();
  const getPts = p => (typeof p.lastPoints === 'number' ? p.lastPoints : (p.points || 0));

  const keepers = squadPlayers.filter(p => getPos(p) === 'keeper').sort((a, b) => getPts(b) - getPts(a));
  const defenders = squadPlayers.filter(p => getPos(p) === 'defender').sort((a, b) => getPts(b) - getPts(a));
  const midfielders = squadPlayers.filter(p => getPos(p) === 'midfielder').sort((a, b) => getPts(b) - getPts(a));
  const strikers = squadPlayers.filter(p => getPos(p) === 'striker').sort((a, b) => getPts(b) - getPts(a));

  const validFormations = [
    { name: '3-4-3', d: 3, m: 4, s: 3 },
    { name: '3-5-2', d: 3, m: 5, s: 2 },
    { name: '4-3-3', d: 4, m: 3, s: 3 },
    { name: '4-4-2', d: 4, m: 4, s: 2 },
    { name: '4-5-1', d: 4, m: 5, s: 1 },
    { name: '5-3-2', d: 5, m: 3, s: 2 },
    { name: '5-4-1', d: 5, m: 4, s: 1 }
  ];

  let bestScore = -999;
  let bestFormation = '3-4-3';
  let best11 = [];

  const bestGk = keepers[0];
  const gkScore = bestGk ? getPts(bestGk) : 0;

  for (const f of validFormations) {
    if (defenders.length < f.d || midfielders.length < f.m || strikers.length < f.s || !bestGk) {
      continue;
    }

    const dP = defenders.slice(0, f.d);
    const mP = midfielders.slice(0, f.m);
    const sP = strikers.slice(0, f.s);

    const dScore = dP.reduce((s, p) => s + getPts(p), 0);
    const mScore = mP.reduce((s, p) => s + getPts(p), 0);
    const sScore = sP.reduce((s, p) => s + getPts(p), 0);

    const total = gkScore + dScore + mScore + sScore;

    if (total > bestScore) {
      bestScore = total;
      bestFormation = f.name;
      best11 = [bestGk, ...dP, ...mP, ...sP];
    }
  }

  return {
    optimalScore: bestScore > -900 ? bestScore : 0,
    optimalFormation: bestFormation,
    optimal11: best11
  };
}

export function detectSquadTrends(squadPlayers = []) {
  const trends = squadPlayers.map(p => {
    const pts = typeof p.lastPoints === 'number' ? p.lastPoints : (p.points || 0);
    const price = p.price || 0;

    let trendStatus = 'NEUTRO';
    let trendEmoji = '⚖️';
    let momentumScore = 0;

    if (pts >= 8) {
      trendStatus = 'EN_RACHA';
      trendEmoji = '🔥';
      momentumScore = 3.0;
    } else if (pts >= 5) {
      trendStatus = 'ASCENDENTE';
      trendEmoji = '📈';
      momentumScore = 1.5;
    } else if (pts >= 2) {
      trendStatus = 'ESTABLE';
      trendEmoji = '🟢';
      momentumScore = 0;
    } else if (pts > 0) {
      trendStatus = 'DISCRETO';
      trendEmoji = '❄️';
      momentumScore = -0.5;
    } else {
      trendStatus = 'SIN_PUNTOS';
      trendEmoji = '💤';
      momentumScore = -1.5;
    }

    return {
      id: p.id || p.playerId,
      name: p.name,
      position: p.position || p.type,
      clubName: p.clubName || 'LaLiga',
      price,
      lastPoints: pts,
      trendStatus,
      trendEmoji,
      momentumScore
    };
  });

  trends.sort((a, b) => b.lastPoints - a.lastPoints);
  return trends;
}

export function generateBenchAuditReport(squad, startersIds = []) {
  const players = squad?.players || [];
  const benchAudit = auditBenchPerformance(players, startersIds);
  const hindsight = calculateOptimalHindsight11(players);
  const trends = detectSquadTrends(players);

  const pointsLost = Math.max(0, hindsight.optimalScore - benchAudit.starterPoints);

  const reportData = {
    timestamp: new Date().toISOString(),
    starterPoints: benchAudit.starterPoints,
    benchPoints: benchAudit.benchPoints,
    optimalPossiblePoints: hindsight.optimalScore,
    optimalFormation: hindsight.optimalFormation,
    pointsLostInBench: pointsLost,
    topBenchPlayer: benchAudit.topBenchPerformer,
    missedOpportunities: benchAudit.missedOpportunities,
    trends,
    recommendations: []
  };

  if (pointsLost > 0 && benchAudit.topBenchPerformer) {
    reportData.recommendations.push(
      `Considerar a ${benchAudit.topBenchPerformer.name} (+${benchAudit.topBenchPerformer.points} pts) para el Once Titular de la próxima jornada.`
    );
  }

  try {
    const dataDir = path.resolve('web/src/data');
    if (fs.existsSync(dataDir)) {
      fs.writeFileSync(path.join(dataDir, 'benchTrends.json'), JSON.stringify(reportData, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('[BENCH-AUDITOR] No se pudo escribir benchTrends.json:', e.message);
  }

  return reportData;
}