/**
 * Motor de Inteligencia y Toma de Decisiones para Comunio
 */

import {
  getStrategy,
  calculateSquadValue,
  calculateMarginalValue,
  calculateReplacementLoss,
  calculatePositionNeed,
  getExpectedPerformance,
  calculateStrategicPurchaseScore,
  calculateMaxRationalBid,
  evaluateIncomingOffer,
  evaluateSalePortfolio,
  evaluatePostSigningSale
} from './squadOptimizer.js';

export class ComunioEngine {

  /**
   * Calcula la predicción estimada de puntos para la próxima jornada del 11 titular.
   */
  getMatchdayPrediction(starting11) {
    if (!starting11 || starting11.length === 0) return 0;
    let total = 0;
    for (const p of starting11) {
      let avg = parseFloat(p.average?.points ? String(p.average.points).replace(',', '.') : 0);
      if (isNaN(avg) || avg <= 0) {
        if (p.expectedPoints && p.expectedPoints > 15) {
          avg = p.expectedPoints / 10;
        } else if (p.expectedPoints && p.expectedPoints > 0) {
          avg = p.expectedPoints;
        } else {
          avg = 4.2; // Baseline por jugador titular
        }
      }
      total += avg;
    }
    return Math.round(total);
  }

  constructor() {
    this.formations = {
      '3-4-3': { keeper: 1, defender: 3, midfielder: 4, striker: 3 },
      '3-5-2': { keeper: 1, defender: 3, midfielder: 5, striker: 2 },
      '4-4-2': { keeper: 1, defender: 4, midfielder: 4, striker: 2 },
      '4-3-3': { keeper: 1, defender: 4, midfielder: 3, striker: 3 },
      '4-5-1': { keeper: 1, defender: 4, midfielder: 5, striker: 1 },
      '5-3-2': { keeper: 1, defender: 5, midfielder: 3, striker: 2 },
      '5-4-1': { keeper: 1, defender: 5, midfielder: 4, striker: 1 }
    };
  }

  /**
   * Calcula la dificultad del partido de la próxima jornada según el rival.
   * Modificador: Rival Gigante (Barça, Madrid, Atleti) -> -25%
   * Salida complicada -> -15%
   * Partido favorable en casa vs zona baja -> +10%
   */
  getMatchDifficultyModifier(player, matchData) {
    if (!matchData) return 1.0;

    let opponent = ((matchData.opponent || matchData.rival || '').toLowerCase());
    let isAway = Boolean(matchData.isAway || matchData.away);

    // Si matchData contiene el cruce oficial de Comunio API ({ homeClub, guestClub })
    if (matchData.homeClub && matchData.guestClub) {
      const playerClub = (player?.club?.name || player?.clubName || '').toLowerCase();
      const homeName = (matchData.homeClub.name || '').toLowerCase();
      const guestName = (matchData.guestClub.name || '').toLowerCase();

      if (playerClub && (homeName.includes(playerClub) || playerClub.includes(homeName))) {
        opponent = guestName;
        isAway = false;
      } else {
        opponent = homeName;
        isAway = true;
      }
    }

    // Rival Gigante (Penalización del 25%)
    const giants = ['real madrid', 'barcelona', 'fc barcelona', 'barça', 'atletico', 'atlético', 'atleti'];
    if (giants.some(g => opponent.includes(g))) {
      return 0.75;
    }

    // Rival Alto fuera de casa (Penalización del 15%)
    const toughTeams = ['real sociedad', 'athletic', 'villarreal', 'girona', 'betis', 'sevilla'];
    if (isAway && toughTeams.some(t => opponent.includes(t))) {
      return 0.85;
    }

    // Partido favorable en casa vs rival accesible (Bonus +10%)
    if (!isAway && (opponent.includes('alaves') || opponent.includes('elche') || opponent.includes('valladolid') || opponent.includes('cadiz') || opponent.includes('granada') || opponent.includes('leganes') || opponent.includes('espanyol') || opponent.includes('getafe'))) {
      return 1.10;
    }

    return 1.0;
  }

  /**
   * Calcula la puntuación de calidad / valor de un jugador.
   * Ponderación Dinámica: Puntos Recientes (50%) + Histórico Base (35%) + Estado de Salud/Racha (15%) + Dificultad Rival.
   */
  getExpectedPoints(player, matchData = null) {
    let baseScore = 0;

    // 1. Si el jugador tiene puntos en la temporada actual, usar su promedio real
    const totalCurrentPoints = player.totalPoints || 0;
    const avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
    
    if (!isNaN(avgPoints) && avgPoints > 0) {
      baseScore = Math.round(avgPoints * 25);
    } else if (totalCurrentPoints > 0) {
      baseScore = totalCurrentPoints * 10;
    } else {
      // 2. Si lleva 0 puntos en la temporada actual y cuesta poco (< 1M €), es un jugador sin minutos / saliendo de lesión
      const price = player.price || 0;
      if (price < 1000000) {
        baseScore = 5; // Puntuación mínima para parches sin minutos
      } else {
        // Para jugadores recién fichados de alto valor (> 1M €), usar histórico reciente ponderado
        const historyList = Array.isArray(player.historical)
          ? player.historical
          : (player.historical?.points || player.historicalPoints || []);

        if (historyList.length > 0) {
          const validPoints = historyList.map(h => parseInt(h.points) || 0).filter(p => p > 0);
          if (validPoints.length > 0) {
            const bestHistoricalPoints = Math.max(...validPoints);
            baseScore = Math.round(bestHistoricalPoints * 0.6); // Ponderación prudente
          }
        }
        if (baseScore === 0) {
          if (price > 5000000) baseScore = 120;
          else if (price > 2000000) baseScore = 70;
          else baseScore = 30;
        }
      }
    }

    // 3. Ponderación por Racha Reciente (si se dispone de historial de últimas 3 jornadas)
    const recentScores = player.lastMatches || player.recentScores || [];
    if (Array.isArray(recentScores) && recentScores.length > 0) {
      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      baseScore = Math.round((recentAvg * 25 * 0.50) + (baseScore * 0.50));
    }

    // 4. Penalización por Salud o Duda Médica (evita alinear jugadores en riesgo de 0 ptos)
    const statusLower = ((player.status || '') + ' ' + (player.statusInfo || '')).toLowerCase();
    if (statusLower.includes('duda') || statusLower.includes('molestias')) {
      baseScore = Math.round(baseScore * 0.40); // Penalización preventiva del 60%
    }

    // 5. Aplicar Modificador por Pronóstico de Partido / Dificultad del Rival
    const matchMod = this.getMatchDifficultyModifier(player, matchData);
    baseScore = Math.round(baseScore * matchMod);

    return baseScore;
  }

  /**
   * Determina si un jugador está 100% activo y disponible para el Once Titular
   */
  isPlayerAvailable(player) {
    if (!player) return false;

    // 1. Comprobar tarjetas rojas directas o doble amarilla activa
    if (player.cards && (player.cards.red > 0 || player.cards.yellowRed > 0)) {
      return false;
    }

    const statusLower = ((player.status || '') + ' ' + (player.statusInfo || '') + ' ' + (player.availability || '')).toLowerCase();
    
    // Lista completa de estados no disponibles (sanciones, rojas, lesiones, cirugías, dudas)
    const unavailableKeywords = [
      'injured', 'suspended', 'rehabilitation', 'retired', 'away',
      'lesionado', 'sancionado', 'baja', 'duda', 'debilitado',
      'molestias', 'cirugia', 'cirugía', 'quirófano', 'hombro', 'rotura',
      'red_banned', 'yellow_banned', 'banned', 'ban', 'sancion', 'sanción',
      'expulsado', 'expulsión', 'roja'
    ];
    
    return !unavailableKeywords.some(keyword => statusLower.includes(keyword));
  }

  /**
   * Calcula la mejor alineación posible (formación y 11 jugadores)
   */
  optimizeLineup(squad) {
    if (!squad || !squad.players || squad.players.length === 0) {
      return { error: 'No se encontraron jugadores en la plantilla.' };
    }

    const players = squad.players.map(p => {
      const type = p.type || p.position;
      const nextMatch = (p.nextMatches && p.nextMatches.length > 0) ? p.nextMatches[0] : null;
      return {
        ...p,
        type,
        expectedPoints: this.getExpectedPoints(p, nextMatch),
        available: this.isPlayerAvailable(p)
      };
    });

    // Separar por posiciones
    const keepers = players.filter(p => p.type === 'keeper');
    const defenders = players.filter(p => p.type === 'defender');
    const midfielders = players.filter(p => p.type === 'midfielder');
    const strikers = players.filter(p => p.type === 'striker');

    let bestFormation = null;
    let bestScore = -1;
    let bestStarting11 = [];
    let bestBench = [];

    // Evaluar cada formación táctica válida
    for (const [formName, slots] of Object.entries(this.formations)) {
      const selected = [];
      const bench = [];

      // Función para seleccionar los mejores disponibles y luego no disponibles por posición
      const fillPosition = (pool, count) => {
        // Ordenar: primero disponibles con más puntos, luego no disponibles con más puntos
        const sortedPool = [...pool].sort((a, b) => {
          if (a.available !== b.available) return b.available ? 1 : -1;
          return b.expectedPoints - a.expectedPoints;
        });

        const selectedForPos = sortedPool.slice(0, count);
        const remainingForPos = sortedPool.slice(count);

        selected.push(...selectedForPos);
        bench.push(...remainingForPos);
      };

      fillPosition(keepers, slots.keeper);
      fillPosition(defenders, slots.defender);
      fillPosition(midfielders, slots.midfielder);
      fillPosition(strikers, slots.striker);

      // Calcular puntuación esperada de la formación
      const score = selected.reduce((sum, p) => sum + (p.available ? p.expectedPoints : 0), 0);

      // Penalización por huecos vacíos (-4 puntos por cada jugador que falte)
      const missingCount = 11 - selected.length;
      const finalScore = score - (missingCount * 4);

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestFormation = formName;
        bestStarting11 = selected;
        bestBench = bench;
      }
    }

    return {
      formation: bestFormation,
      score: bestScore,
      starting11: bestStarting11.map(p => ({ playerId: p.playerId, name: p.name, type: p.type, price: p.price, available: p.available, expectedPoints: p.expectedPoints })),
      bench: bestBench.map(p => ({ playerId: p.playerId, name: p.name, type: p.type, price: p.price, available: p.available, expectedPoints: p.expectedPoints }))
    };
  }

  /**
   * Obtiene la valoración de rendimiento independiente de la jornada (PPM, proyección, eficiencia)
   */
  getExpectedPerformance(player) {
    return getExpectedPerformance(player, getStrategy());
  }

  /**
   * Determina si se debe poner en venta a un jugador tras haber completado un fichaje.
   * Evalúa la plantilla antes, después del fichaje y tras una posible venta.
   */
  evaluateSaleTriggerAfterSigning(newSigning, squad, balance = 0) {
    const result = evaluatePostSigningSale(this, newSigning, squad, balance);
    return {
      shouldListForSale: result.shouldSell,
      playerToList: result.saleCandidate,
      reason: result.reason,
      squadValues: result.squadValues
    };
  }

  /**
   * Evalúa una oferta de venta recibida por un jugador de nuestra plantilla.
   * Reglas racionales:
   * 1. Selección de la mejor oferta (preferencia Computer en caso de empate).
   * 2. Protección de jugadores Core basada en pérdida por reemplazo del XI (marginal).
   * 3. Manejo de deuda racional (no malvender destruyendo valor).
   */
  evaluateSaleOffer(player, offers, squad, currentBalance = 0) {
    if (!offers || offers.length === 0) {
      return { shouldAccept: false, reason: 'No hay ofertas para este jugador.' };
    }

    // 1. Ordenar ofertas de mayor a menor importe
    const sortedOffers = [...offers].sort((a, b) => b.price - a.price);
    const bestOffer = sortedOffers[0];

    // Identificar si la Computadora ha hecho oferta
    const computerOffer = offers.find(o => o.user?.id === 1 || (o.user?.name && o.user.name.toLowerCase().includes('computer')));

    // Si la Computadora ofrece lo mismo o más que un rival, elegir la de la Computadora para no reforzar a rivales
    let chosenOffer = bestOffer;
    if (computerOffer && computerOffer.price >= bestOffer.price) {
      chosenOffer = computerOffer;
    }

    const evalResult = evaluateIncomingOffer(this, player, chosenOffer, squad, currentBalance);

    return {
      shouldAccept: evalResult.shouldAccept,
      action: evalResult.action,
      chosenOffer,
      replacementLoss: evalResult.replacementLoss,
      reason: evalResult.reasoning.join(' ')
    };
  }

  /**
   * Analiza el mercado de fichajes utilizando el motor de optimización de plantilla (Mejora Real sobre el Mejor Once).
   */
  analyzeMarket(marketPlayers, squad, balance, rivalIntel = null) {
    if (!marketPlayers || marketPlayers.length === 0) {
      return { recommendations: [], message: 'No hay jugadores en el mercado para analizar.' };
    }

    const currentSquad = squad?.players || [];
    const mySquadIds = new Set(currentSquad.map(p => parseInt(p.playerId || p.id || 0)).filter(id => id > 0));

    const recommendations = [];

    for (const player of marketPlayers) {
      const pid = parseInt(player.playerId || player.id);

      // 1. Exclusión estricta: Jamás ofrecer nuestros propios jugadores puestos en el mercado
      if (mySquadIds.has(pid)) continue;
      if (player.owner?.id && squad?.userId && player.owner.id === squad.userId) continue;

      const ownerName = (player.owner?.name || 'Computer').trim();
      const isComputer = player.owner?.id === 1 || ownerName.toLowerCase() === 'computer';

      const isAvailable = this.isPlayerAvailable(player);
      if (!isAvailable) continue; // Ignorar lesionados o sancionados del mercado

      // 2. Filtro de calidad general
      const expectedPoints = this.getExpectedPoints(player);
      const avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
      if (expectedPoints < 25 && avgPoints < 3.0 && player.price > 1500000) {
        continue;
      }

      // 3. Modificador por Calendario & Dificultad del Rival Inminente
      const calendarMod = this.getMatchDifficultyModifier(player, { opponent: player.nextOpponent || player.clubName || '' });
      const adjustedExpectedPoints = Math.round(expectedPoints * calendarMod);

      // 4. Evaluación de Squad Optimization (Mejora Real sobre el Mejor Once)
      const purchaseScore = calculateStrategicPurchaseScore(this, player, squad, balance, rivalIntel);
      const bidCalc = calculateMaxRationalBid(player, purchaseScore, balance, rivalIntel);

      const marginalValue = purchaseScore.marginalValue;
      const upgradePoints = marginalValue; // Mapping para compatibilidad con código existente
      const ppm = purchaseScore.performance.ppm;
      const efficiency = purchaseScore.performance.efficiency;

      // 5. Categorización racional
      let category = 'EL_RESTO';
      let impactTag = '⛔ EL RESTO (Sin Mejora Significativa)';

      if (purchaseScore.entersXI && marginalValue >= 8) {
        category = 'SALTO_CUALITATIVO';
        impactTag = marginalValue >= 15 ? '🏆 SALTO CUALITATIVO ESTRELLA (+15 pts XI)' : '🚀 SALTO CUALITATIVO (+8 pts XI)';
      } else if (purchaseScore.entersXI || marginalValue >= 3 || purchaseScore.score >= 35) {
        category = 'MEJORA_MODERADA';
        impactTag = '📈 MEJORA TÁCTICA / ROTACIÓN';
      } else if (purchaseScore.score >= 25) {
        category = 'MEJORA_MODERADA';
        impactTag = '📈 OPORTUNIDAD DE MERCADO / FONDO DE ARMARIO';
      }

      const isSquadFull = currentSquad.length >= 15;

      recommendations.push({
        playerId: pid,
        name: player.name,
        type: player.type,
        price: player.price,
        bidAmount: bidCalc.recommendedBid,
        maxRationalBid: bidCalc.maxRationalBid,
        marginPct: bidCalc.marginPct,
        expectedPoints: adjustedExpectedPoints,
        ppm,
        efficiency,
        upgradePoints,
        marginalValue,
        strategicScore: purchaseScore.score,
        strategicComponents: purchaseScore.components,
        category,
        impactTag,
        action: bidCalc.action,
        ownerName,
        isComputer,
        requiresSaleFirst: isSquadFull,
        reasoning: purchaseScore.reasoning.concat(bidCalc.reasoning),
        reason: `${impactTag}: Mejora real del XI: +${marginalValue.toFixed(0)} pts. ${bidCalc.reasoning[0] || ''}`
      });
    }

    // Ordenar recomendaciones: primero los fichajes de mayor puntuación estratégica
    recommendations.sort((a, b) => b.strategicScore - a.strategicScore);

    let bestValueOffer = null;
    if (recommendations.length > 0) {
      const sortedByEfficiency = [...recommendations].sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));
      bestValueOffer = sortedByEfficiency[0];
      if (bestValueOffer) {
        bestValueOffer.isBestValue = true;
      }
    }

    return {
      recommendations,
      bestValueOffer,
      message: `Se han encontrado ${recommendations.length} oportunidades de fichaje evaluadas.`
    };
  }

  /**
   * Gestiona la economía y optimiza la cartera de ventas en caso de deuda
   */
  manageEconomy(squad, balance) {
    const currentSquad = squad?.players || [];
    const report = {
      inDebt: balance < 0,
      balance,
      requiredSalesValue: balance < 0 ? Math.abs(balance) : 0,
      suggestedSales: [],
      message: 'Economía saneada, balance positivo.'
    };

    if (balance >= 0) {
      return report;
    }

    console.log(`[ENGINE] Alerta de Deuda: Balance de ${balance.toLocaleString()} €. Optimizando cartera de ventas...`);

    const portfolio = evaluateSalePortfolio(this, squad, Math.abs(balance));
    report.suggestedSales = portfolio.suggestedSales.map(s => ({
      playerId: s.playerId,
      name: s.name,
      type: s.type,
      price: s.salePrice,
      isAvailable: s.wasInXI,
      replacementLoss: s.replacementLoss,
      reason: s.reason
    }));

    report.totalSportingLoss = portfolio.totalSportingLoss;
    report.totalCashGenerated = portfolio.totalCash;
    report.message = `¡ALERTA! Deuda de ${balance.toLocaleString()} €. Cartera óptima de venta calculada (${report.suggestedSales.length} jugadores, pérdida deportiva de ${portfolio.totalSportingLoss} pts).`;

    return report;
  }

  getWeakestPlayer(players, type) {
    const pool = players.filter(p => p.type === type);
    if (pool.length === 0) return null;
    
    // Retorna el que tenga menor puntuación esperada
    return pool.sort((a, b) => this.getExpectedPoints(a) - this.getExpectedPoints(b))[0];
  }

  /**
   * Sugiere ventas opcionales para ganar liquidez
   */
  getLiquiditySuggestions(squad, starting11Ids) {
    const currentSquad = squad?.players || [];
    const suggestions = [];

    currentSquad.forEach(p => {
      const isLinedUp = starting11Ids.includes(p.playerId);
      const isAvailable = this.isPlayerAvailable(p);
      
      // 1. Caso crítico: Lesionados graves de larga duración
      if (!isAvailable && (p.statusInfo || '').toLowerCase().includes('baja') || (p.statusInfo || '').toLowerCase().includes('diciembre') || (p.statusInfo || '').toLowerCase().includes('rotura') || (p.statusInfo || '').toLowerCase().includes('cruzado')) {
        suggestions.push({
          playerId: p.playerId,
          name: p.name,
          price: p.price,
          reason: `Lesión grave/largo plazo (${p.statusInfo}). Vender libera ${p.price.toLocaleString()} €.`
        });
      }
      // 2. Caso secundario: Suplentes de alto valor económico secuestrado
      else if (!isLinedUp && p.price > 1500000) {
        suggestions.push({
          playerId: p.playerId,
          name: p.name,
          price: p.price,
          reason: `Suplente de alto valor en el banquillo. Vender libera ${p.price.toLocaleString()} € para fichajes titulares.`
        });
      }
    });

    return suggestions;
  }
}
