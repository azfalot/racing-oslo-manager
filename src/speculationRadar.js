/**
 * Módulo Diario de Especulación Financiera y Trading de Jugadores (Comunio)
 *
 * Analiza sistemáticamente el mercado de Computer para identificar activos de alta rentabilidad
 * financiera a corto y medio plazo (1 a 3 jornadas), permitiendo generar tesorería continua:
 * 
 * 1. CRACK_RECOVERY: Estrellas de 8M-15M€ en recta final de lesión a precio de saldo (< 3M€).
 * 2. FLOOR_PRICE_BARGAIN: Chollos en precio suelo (160k - 300k €) con riesgo de pérdida 0€.
 * 3. RISING_MOMENTUM: Jugadores en racha goleadora o fichajes recientes en fuerte subida diaria.
 * 4. ARBITRAGE_FLIP: Compra a VM exacto y venta inmediata con plusvalía a Computer.
 */

import { evaluateClubMomentum } from './clubMomentum.js';
import { isVerifiedComputerOwner } from './ownership.js';

// Base de conocimiento médica y plazos de recuperación conocidos en LaLiga 26/27
export const INJURY_RECOVERY_INTEL = {
  'gavi': {
    status: 'FASE_FINAL',
    returnWindow: 'Jornada 5 - 7 (Entrenando con grupo)',
    expectedRevaluationPct: 150, // De 1.9M a 5M+
    intrinsicValue: 10000000,
    dailyGrowthEstEUR: 65000,
    riskRating: 'BAJO (Precio suelo histórico)'
  },
  'tchouameni': {
    status: 'ALTA_INMINENTE',
    returnWindow: 'Jornada 5 (Disponible UCL / Liga)',
    expectedRevaluationPct: 50, // De 4.8M a 7.5M
    intrinsicValue: 8500000,
    dailyGrowthEstEUR: 80000,
    riskRating: 'MINIMO'
  },
  'aimar oroz': {
    status: 'RECUPERADO',
    returnWindow: 'Jornada 5 (100% disponible titular)',
    expectedRevaluationPct: 45, // De 1.8M a 2.8M
    intrinsicValue: 3500000,
    dailyGrowthEstEUR: 40000,
    riskRating: 'MINIMO'
  },
  'frenkie de jong': {
    status: 'FASE_MEDIA',
    returnWindow: 'Jornada 7 - 8',
    expectedRevaluationPct: 90,
    intrinsicValue: 8000000,
    dailyGrowthEstEUR: 45000,
    riskRating: 'MODERADO'
  },
  'camavinga': {
    status: 'FASE_FINAL',
    returnWindow: 'Jornada 6',
    expectedRevaluationPct: 60,
    intrinsicValue: 7000000,
    dailyGrowthEstEUR: 55000,
    riskRating: 'BAJO'
  },
  'alaba': {
    status: 'REHABILITACION_LARGA',
    returnWindow: 'Noviembre / Diciembre',
    expectedRevaluationPct: 20,
    intrinsicValue: 2500000,
    dailyGrowthEstEUR: 10000,
    riskRating: 'ALTO (Recuperación lenta)'
  }
};

function normalizeName(name) {
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Evalúa las oportunidades de especulación en el mercado de fichajes.
 * @param {Array} marketPlayers Lista de jugadores en el mercado
 * @param {Object} squad Plantilla actual
 * @param {number} currentBalance Saldo disponible
 * @returns {{ opportunities: Array, summary: Object, strategyRecommendations: string[] }}
 */
export function scanSpeculationOpportunities(marketPlayers = [], squad = null, currentBalance = 0) {
  const squadSize = (squad?.players || []).length;
  const maxAllowedSquadSize = 15;
  const freeSlots = Math.max(0, maxAllowedSquadSize - squadSize);

  const opportunities = [];

  for (const p of marketPlayers) {
    const isComputer = isVerifiedComputerOwner(p);
    const price = p.price || p.quotedPrice || 0;
    const pName = normalizeName(p.name || p.playerName);
    const rawClub = p.club?.name || p.clubName || p.teamName || '';

    // Solo se especula comprando a Computer para garantizar liquidez y salida limpia
    if (!isComputer) continue;

    // 1. Chequeo de CRACK_RECOVERY (Estrellas lesionadas a precio de saldo)
    let recoveryMatch = null;
    for (const [key, data] of Object.entries(INJURY_RECOVERY_INTEL)) {
      if (pName.includes(key) || key.includes(pName)) {
        recoveryMatch = { key, ...data };
        break;
      }
    }

    if (recoveryMatch && price < recoveryMatch.intrinsicValue * 0.70) {
      const upsideEUR = recoveryMatch.intrinsicValue - price;
      const roiPct = Math.round((upsideEUR / price) * 100);

      opportunities.push({
        playerId: p.playerId || p.id,
        name: p.name,
        position: p.type || p.position,
        club: rawClub,
        owner: p.owner || { id: p.ownerId || 1, name: p.ownerName || 'Computer' },
        price,
        tier: 'CRACK_RECOVERY',
        tierLabel: '💎 Crack en Recuperación / Revalorización Explosiva',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        recoveryStatus: recoveryMatch.status,
        returnWindow: recoveryMatch.returnWindow,
        estimatedRoiPct: roiPct,
        projectedUpsideEUR: upsideEUR,
        dailyGrowthEstEUR: recoveryMatch.dailyGrowthEstEUR,
        intrinsicValue: recoveryMatch.intrinsicValue,
        downsideRisk: recoveryMatch.riskRating,
        recommendation: 'COMPRAR_Y_MANTENER',
        actionLabel: `Pujar VM (${price.toLocaleString()} €) • Retorno estimado: +${roiPct}% (+${upsideEUR.toLocaleString()} €)`,
        priorityScore: 95
      });
      continue;
    }

    // 2. Chequeo de FLOOR_PRICE_BARGAIN (Chollos en precio suelo < 300.000 €)
    // Filtro estricto: NUNCA fichar futbolistas con lesión activa, incluso a 160k
    const isInjured = p.status === 'INJURED' || Boolean(p.isInjured) || (p.statusInfo && p.statusInfo.toLowerCase().includes('lesion'));
    if (price <= 300000 && price > 0 && !isInjured) {
      const estimatedGainEUR = Math.round(price * 0.35 + 80000);
      opportunities.push({
        playerId: p.playerId || p.id,
        name: p.name,
        position: p.type || p.position,
        club: rawClub,
        owner: p.owner || { id: p.ownerId || 1, name: p.ownerName || 'Computer' },
        price,
        tier: 'FLOOR_PRICE_BARGAIN',
        tierLabel: '🪙 Precio Suelo / Riesgo Cero',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        recoveryStatus: 'ACTIVO_O_PARCHE',
        returnWindow: 'Inmediato',
        estimatedRoiPct: Math.round((estimatedGainEUR / price) * 100),
        projectedUpsideEUR: estimatedGainEUR,
        dailyGrowthEstEUR: 15000,
        intrinsicValue: price + estimatedGainEUR,
        downsideRisk: 'CERO (Precio mínimo garantizado por Comunio)',
        recommendation: 'COMPRAR_FLIP_RAPIDO',
        actionLabel: `Pujar valor mínimo (${price.toLocaleString()} €) • Riesgo 0€ • Beneficio rápido`,
        priorityScore: 85
      });
      continue;
    }

    // 3. Chequeo de RISING_MOMENTUM (Fichajes recientes o jugadores en fuerte alza con precio < 2M€)
    const points = p.points || (p.stats?.points) || 0;
    const avgPts = parseFloat(p.average?.points ? String(p.average.points).replace(',', '.') : 0);
    const momentum = evaluateClubMomentum(p);

    if (price <= 2000000 && (points >= 10 || avgPts >= 4.5 || momentum.state === 'SURGING')) {
      const estimatedGainEUR = Math.round(price * 0.40);
      opportunities.push({
        playerId: p.playerId || p.id,
        name: p.name,
        position: p.type || p.position,
        club: rawClub,
        owner: p.owner || { id: p.ownerId || 1, name: p.ownerName || 'Computer' },
        price,
        tier: 'RISING_MOMENTUM',
        tierLabel: '🚀 Activo en Racha / Subida Diaria',
        badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        recoveryStatus: 'DISPONIBLE_EN_RACHA',
        returnWindow: 'Titular / Minutos asegurados',
        estimatedRoiPct: 40,
        projectedUpsideEUR: estimatedGainEUR,
        dailyGrowthEstEUR: 35000,
        intrinsicValue: price + estimatedGainEUR,
        downsideRisk: 'BAJO',
        recommendation: 'COMPRAR_Y_VENDER_EN_PICO',
        actionLabel: `Pujar VM (${price.toLocaleString()} €) • Subida diaria estimada +35k€`,
        priorityScore: 80
      });
      continue;
    }
  }

  // Ordenar por prioridad estratégica
  opportunities.sort((a, b) => b.priorityScore - a.priorityScore || b.estimatedRoiPct - a.estimatedRoiPct);

  const totalProjectedGainsEUR = opportunities.reduce((s, o) => s + o.projectedUpsideEUR, 0);

  const strategyRecommendations = [
    `🎯 Capacidad de plantilla disponible: ${freeSlots} hueco(s) libre(s) para trading sin forzar ventas.`,
    `💡 Regla de Oro del Trading Comunio: Pujar SIEMPRE el valor de mercado exacto a Computer (0% sobreprecio) para maximizar margen de ganancia.`,
    `💰 Salida de Posición: En cuanto Computer haga oferta matinal con +3% a +5% de plusvalía o el jugador toque su techo, vender para recuperar liquidez y reinvertir.`
  ];

  if (opportunities.some(o => o.name === 'Gavi')) {
    strategyRecommendations.unshift('🔥 OPORTUNIDAD TOP 1: Gavi (1.910.000 €) es el activo de mayor retorno potencial de todo el mercado (ROI +150% hacia 5M€+).');
  }

  return {
    opportunities,
    totalOpportunitiesCount: opportunities.length,
    totalProjectedGainsEUR,
    freeSlots,
    strategyRecommendations,
    timestamp: new Date().toISOString()
  };
}
