/**
 * Racing de Oslo War Room — Quantitative Command & Strategic Report Generator
 *
 * Generates the definitive daily strategic report and data structures for
 * the Director Deportivo and Manager.
 */

import { identifyPositionalWeaknesses, calculateDepthFragility } from './vorpEngine.js';
import { runChampionshipSimulation } from './championshipSimulator.js';

export function generateWarRoomReport(engine, squad, marketPlayers = [], balance = 0, committedBids = 0, rivalsData = null) {
  const effectiveBalance = balance - committedBids;
  const squadPlayers = squad?.players || [];
  const squadValue = squadPlayers.reduce((sum, p) => sum + (p.price || p.quotedPrice || 0), 0);
  const totalPatrimony = squadValue + balance;

  // 1. Lineup & Expected Points
  const optimalLineup = engine.optimizeLineup(squad);
  const formation = optimalLineup.formation || '4-3-3';
  const expectedPoints = optimalLineup.score || 0;
  const starters = optimalLineup.starting11 || [];

  // Starters with rotation / injury flags
  const starterRisks = starters.filter(s => {
    const fullP = squadPlayers.find(p => (p.playerId || p.id) === (s.playerId || s.id));
    const status = ((fullP?.status || '') + ' ' + (fullP?.statusInfo || '')).toLowerCase();
    return status.includes('duda') || status.includes('molestia') || status.includes('suplente') || (s.expectedPoints < 2.5);
  });

  // 2. Standings & Gap to Leader
  let racingPoints = 188;
  let leaderPoints = 245;
  let leaderName = 'Fermín Gadura F.C.';

  if (Array.isArray(rivalsData) && rivalsData.length > 0) {
    const sortedRivals = [...rivalsData].sort((a, b) => (b.points || 0) - (a.points || 0));
    leaderName = sortedRivals[0].teamName || sortedRivals[0].name || leaderName;
    leaderPoints = sortedRivals[0].points || leaderPoints;
    const racing = sortedRivals.find(r => r.teamName?.includes('Racing') || r.name?.includes('Racing'));
    if (racing) racingPoints = racing.points || racingPoints;
  }

  const gap = leaderPoints - racingPoints;

  // 3. Top 3 Positional Weaknesses
  const allWeaknesses = identifyPositionalWeaknesses(engine, squad);
  const top3Weaknesses = allWeaknesses.slice(0, 3);

  // 4. Depth Fragility
  const depthAnalysis = calculateDepthFragility(squad);

  // 5. Market Analysis & Objectives
  const marketAnalysis = engine.analyzeMarket(marketPlayers, squad, balance);
  const targetRecommendations = (marketAnalysis.recommendations || []).slice(0, 5);

  // 6. Recommended Sales & Liquidity
  const liquiditySuggestions = engine.getLiquiditySuggestions ? engine.getLiquiditySuggestions(squad, starters.map(s => s.playerId || s.id)) : [];

  // 7. Monte Carlo Simulation
  const simulation = runChampionshipSimulation(33);

  // 8. Priority Action of the Day
  let priorityMovement = 'Mantener posiciones y acumular liquidez para oportunidades de alto Expected XI Delta.';
  if (targetRecommendations.length > 0) {
    const topPick = targetRecommendations[0];
    priorityMovement = `Pujar ${topPick.bidAmount?.toLocaleString()} € por ${topPick.name} (${topPick.type}) para sustituir a ${topPick.replacedPlayerName || 'rotación'} (Expected XI Delta: +${topPick.marginalValue || 0} pts, CPMP: ${topPick.costPerMarginalPoint ? topPick.costPerMarginalPoint.toLocaleString() + ' €/pt' : 'Óptimo'}).`;
  } else if (depthAnalysis.isFragile) {
    priorityMovement = 'Fichar 1-2 suplentes económicos (160k-400k €) para blindar el banquillo y eliminar el riesgo de -4 pts por lesión.';
  } else if (balance < 0) {
    priorityMovement = `Vender activo redundante para liquidar déficit de ${Math.abs(balance).toLocaleString()} € antes del corte de jornada.`;
  }

  // ── TEXT FORMATTED REPORT ───────────────────────────────────────────────────
  let textReport = `=== RACING DE OSLO WAR ROOM ===\n\n`;

  textReport += `🏆 CLASIFICACIÓN\n`;
  textReport += `- Puntos Racing: ${racingPoints} pts (2º clasificado)\n`;
  textReport += `- Líder: ${leaderName} (${leaderPoints} pts)\n`;
  textReport += `- Déficit actual: ${gap >= 0 ? '-' + gap : '+' + Math.abs(gap)} pts\n\n`;

  textReport += `💰 FINANZAS\n`;
  textReport += `- Saldo en caja: ${balance.toLocaleString()} €\n`;
  textReport += `- Pujas activas comprometidas: ${committedBids.toLocaleString()} €\n`;
  textReport += `- Saldo efectivo libre: ${effectiveBalance.toLocaleString()} €\n`;
  textReport += `- Valor de plantilla: ${squadValue.toLocaleString()} €\n`;
  textReport += `- Patrimonio total: ${totalPatrimony.toLocaleString()} €\n\n`;

  textReport += `⚔️ MEJOR XI & ESTRUCTURA\n`;
  textReport += `- Formación: ${formation}\n`;
  textReport += `- Expected Points XI: ${expectedPoints.toFixed(1)} pts/jornada\n`;
  textReport += `- Plantilla: ${squadPlayers.length} jugadores (${depthAnalysis.isFragile ? '🚨 FRÁGIL: Solo 11' : '✅ Profundidad OK'})\n`;
  if (starterRisks.length > 0) {
    textReport += `- Riesgos de titularidad en el XI: ${starterRisks.map(r => `${r.name} (${r.expectedPoints} pts)`).join(', ')}\n\n`;
  } else {
    textReport += `- Riesgos de titularidad en el XI: Ninguno (11 titulares consolidados)\n\n`;
  }

  textReport += `🎯 TOP 3 DEBILIDADES DEL ONCE (Máximo Coste de Oportunidad)\n`;
  top3Weaknesses.forEach((w, idx) => {
    textReport += `${idx + 1}. ${w.name} (${w.position.toUpperCase()} · ${w.expectedPoints} pts esp. | VORP: ${w.vorp > 0 ? '+' : ''}${w.vorp} pts | Brecha: +${w.upgradeGap} pts mejora potencial)\n`;
  });
  textReport += `\n`;

  textReport += `🛒 MERCADO HOY (Análisis de Expected XI Delta & VORP)\n`;
  if (targetRecommendations.length > 0) {
    targetRecommendations.forEach(t => {
      textReport += `• Jugador: ${t.name} (${t.type} · VM: ${(t.price || 0).toLocaleString()} €)\n`;
      textReport += `  - Puja Recomendada: ${(t.bidAmount || t.price).toLocaleString()} € | Máx Racional: ${(t.maxRationalBid || t.price).toLocaleString()} €\n`;
      textReport += `  - Jugador Sustituido en XI: ${t.replacedPlayerName || 'Banquillo / Fondo'}\n`;
      textReport += `  - Expected XI Delta: +${(t.marginalValue || 0).toFixed(1)} pts/jornada\n`;
      if (t.costPerMarginalPoint) {
        textReport += `  - Coste por Punto Marginal (CPMP): ${t.costPerMarginalPoint.toLocaleString()} €/pt\n`;
      }
      textReport += `  - Acción: [${t.actionTag || t.action || 'BUY'}] ${t.reason || ''}\n\n`;
    });
  } else {
    textReport += `  (No hay jugadores en el mercado de hoy que generen Expected XI Delta positivo y cumplan solvencia)\n\n`;
  }

  textReport += `📋 VENTAS RECOMENDADAS & GESTIÓN DE LIQUIDEZ\n`;
  if (liquiditySuggestions.length > 0) {
    liquiditySuggestions.forEach(s => {
      textReport += `• Jugador: ${s.name} | VM: ${(s.price || 0).toLocaleString()} €\n`;
      textReport += `  - Impacto en XI: 0 pts (Suplente/Redundante)\n`;
      textReport += `  - Razón: ${s.reason}\n`;
    });
  } else {
    textReport += `  (Plantilla optimizada sin activos prescindibles)\n`;
  }
  textReport += `\n`;

  textReport += `🎲 SIMULACIÓN DE CAMPEONATO (Monte Carlo · 1.000 iteraciones)\n`;
  textReport += `- P(Racing de Oslo 1º Campeón): ${simulation.probChampion}%\n`;
  textReport += `- P(Top 2): ${simulation.probTop2}%\n`;
  textReport += `- P(Top 3): ${simulation.probTop3}%\n`;
  textReport += `- Puntos Finales Estimados: ${simulation.racingExpectedFinalPoints} pts (${simulation.racingRange})\n`;
  textReport += `- Puntos Líder (${simulation.leaderName}): ${simulation.leaderExpectedPoints} pts\n\n`;

  textReport += `⭐ MOVIMIENTO PRIORITARIO DEL DÍA\n`;
  textReport += `👉 ${priorityMovement}\n`;

  return {
    rawText: textReport,
    data: {
      timestamp: new Date().toISOString(),
      standings: { racingPoints, leaderPoints, leaderName, gap },
      finances: { balance, committedBids, effectiveBalance, squadValue, totalPatrimony },
      lineup: { formation, expectedPoints, starterCount: starters.length, starterRisks },
      weaknesses: top3Weaknesses,
      depthAnalysis,
      marketTargets: targetRecommendations,
      liquiditySuggestions,
      simulation,
      priorityMovement
    }
  };
}
