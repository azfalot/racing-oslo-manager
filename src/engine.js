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
import { MinuteTracker } from './minuteTracker.js';
import { DisciplineMonitor } from './disciplineMonitor.js';
import { LineupScraper } from './lineupScraper.js';

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
   * Calcula la proyección total de puntos para toda la temporada (38 jornadas)
   * basada en histórico consolidado en Primera División, valor de mercado y rol de titularidad.
   */
  getSeasonProjection(player) {
    if (!player) return 80;
    const price = player.price || 0;
    const historical = player.historicalPoints || (player.historical?.points || player.historical || []);
    const validHist = (Array.isArray(historical) ? historical : [])
      .map(h => parseInt(h.points) || 0)
      .filter(pt => pt > 0);
    
    const bestHist = validHist.length > 0 ? Math.max(...validHist) : 0;
    const recentHist = validHist.length > 0 ? validHist[validHist.length - 1] : 0;

    let proj = 0;

    // 1. Si tiene historial contrastado en Primera División
    if (recentHist > 0 || bestHist > 0) {
      proj = recentHist > 0 ? (recentHist * 0.70 + bestHist * 0.30) : bestHist;
    }

    // 2. Calibración empírica por jerarquía de mercado y titularidad en LaLiga
    if (price > 15000000) {
      // Crack Galáctico (Valverde, Vinicius, Bellingham): 220 - 260 pts
      proj = Math.max(proj * 0.95, 225);
    } else if (price > 7000000) {
      // Estrella de Primera (Gerard Moreno): 175 - 210 pts
      proj = Math.max(proj * 0.95, 185);
    } else if (price > 3000000) {
      // Titular consolidado (Hugo Duro, Soria, Mandi, Dela, Galarreta, Jon Martín): 135 - 175 pts
      proj = Math.max(proj * 0.90, 145);
    } else if (price > 1000000) {
      // Jugador de rotación frecuente (Moi Gómez): 95 - 130 pts
      proj = Math.max(proj * 0.85, 105);
    } else if (price > 500000) {
      // Joven promesa / Revulsivo (Hugo Álvarez, Pablo Durán, Álvaro Núñez): 60 - 95 pts
      proj = Math.min(Math.max(proj, 65), 95);
    } else {
      // Parche / En recuperación / Sin minutos (Kike Barja): 20 - 45 pts
      proj = Math.min(proj > 0 ? proj * 0.35 : 30, 45);
    }

    return Math.round(proj);
  }

  /**
   * Calcula la puntuación esperada para la jornada actual (en escala de 0 a 10 pts por partido)
   */
  getExpectedPoints(player, matchData = null) {
    if (!player) return 0;

    // 0. Si está sancionado por tarjetas o expulsión federativa -> 0 puntos
    if (DisciplineMonitor.isPlayerSuspended(player)) {
      return 0;
    }

    // 1. Proyección base de la temporada -> Media esperada por partido (34 partidos estimados)
    const seasonProj = this.getSeasonProjection(player);
    let matchExpected = parseFloat((seasonProj / 34).toFixed(2));

    // 2. Si lleva racha reciente en la temporada actual, ponderar
    const avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
    if (!isNaN(avgPoints) && avgPoints > 0) {
      matchExpected = (matchExpected * 0.60) + (avgPoints * 0.40);
    }

    // 3. Penalización por duda médica o molestias físicas
    const statusLower = ((player.status || '') + ' ' + (player.statusInfo || '')).toLowerCase();
    if (statusLower.includes('duda') || statusLower.includes('molestias')) {
      matchExpected = matchExpected * 0.40;
    }

    // 4. Modificador por dificultad del rival / factor campo
    const matchMod = this.getMatchDifficultyModifier(player, matchData);

    // 5. Ponderación por Minutaje Real (MinuteTracker)
    const minuteMod = MinuteTracker.getMinuteMultiplier(player);

    // 6. Ponderación por Probabilidad de Titularidad en Prensa (LineupScraper)
    const lineupProbMod = LineupScraper.getLineupProbabilityMultiplier(player);

    matchExpected = matchExpected * matchMod * minuteMod * lineupProbMod;

    return parseFloat(matchExpected.toFixed(1));
  }

  /**
   * Determina si un jugador está 100% activo y disponible para el Once Titular
   */
  isPlayerAvailable(player) {
    if (!player) return false;

    // 1. Control disciplinario (Rojas, doble amarilla o ciclo de 5 amarillas)
    if (DisciplineMonitor.isPlayerSuspended(player)) {
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
  optimizeLineup(squad, activeClubNames = null) {
    if (!squad || !squad.players || squad.players.length === 0) {
      return { error: 'No se encontraron jugadores en la plantilla.' };
    }

    const players = squad.players.map(p => {
      const type = p.type || p.position;
      const nextMatch = (p.nextMatches && p.nextMatches.length > 0) ? p.nextMatches[0] : null;
      let expPts = this.getExpectedPoints(p, nextMatch);

      // Si se conocen los clubes con partido en esta jornada y este jugador NO juega esta fecha:
      if (Array.isArray(activeClubNames) && activeClubNames.length > 0) {
        const club = (p.club?.name || p.clubName || '').toLowerCase();
        const playsThisRound = activeClubNames.some(c => club.includes(c.toLowerCase()) || c.toLowerCase().includes(club));
        if (!playsThisRound) {
          expPts = 0.1; // Su equipo descansa: puntúa 0 en la jornada (solo sirve de parche de relleno para evitar el -4)
        }
      }

      return {
        ...p,
        type,
        expectedPoints: expPts,
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
   * Evaluación de Especulación con Lesionados con horizonte de recuperación (<= 2 jornadas)
   */
  getInjurySpeculationEvaluation(player, availableCash) {
    const status = ((player.status || '') + ' ' + (player.statusInfo || '')).toUpperCase();
    const isInjured = status.includes('INJUR') || status.includes('LESI') || status.includes('DUDA') || status.includes('BAJA');
    const name = (player.name || '').toLowerCase();

    if (!isInjured && !name.includes('endrick')) {
      return { isInjured: false, returnMatchdays: 0, isApproved: false };
    }

    let returnMatchdays = 1;
    let estimatedReturn = '1-2 jornadas (J3/J4)';
    let injuryType = 'Sobrecarga muscular / Duda';

    if (name.includes('endrick')) {
      returnMatchdays = 1;
      estimatedReturn = '< 2 jornadas (J3/J4)';
      injuryType = 'Molestias musculares';
    } else if (status.includes('CRUZADO') || status.includes('LIGAMENTO') || status.includes('MESES') || status.includes('GRAVE')) {
      returnMatchdays = 12;
      estimatedReturn = '> 10 jornadas';
      injuryType = 'Lesión grave de larga duración';
    } else if (status.includes('ROTURA') || status.includes('MENISCO')) {
      returnMatchdays = 4;
      estimatedReturn = '3-5 jornadas';
      injuryType = 'Rotura fibrilar / Menisco';
    } else if (status.includes('DUDA') || status.includes('MOLESTIA')) {
      returnMatchdays = 1;
      estimatedReturn = '< 2 jornadas';
      injuryType = 'Duda / Molestia puntual';
    }

    const isShortTerm = returnMatchdays <= 2;
    const isAffordable = (player.price || 0) <= (availableCash * 1.6);
    const isApproved = isShortTerm && isAffordable;

    return {
      isInjured: true,
      returnMatchdays,
      estimatedReturn,
      injuryType,
      isShortTerm,
      isAffordable,
      isApproved
    };
  }

  /**
   * Analiza el mercado completo en busca de refuerzos reales para el Once Titular
   */
  analyzeMarket(marketPlayers, squad, balance = 0, rivalIntel = null) {
    if (!Array.isArray(marketPlayers) || marketPlayers.length === 0) {
      return { recommendations: [], bestDeal: null, targetCount: 0 };
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
      const injuryEval = this.getInjurySpeculationEvaluation(player, balance);

      // 🎯 CONTROL DE LESIONADOS: Si está lesionado, SOLO permitir si vuelve en <= 2 jornadas y precio asequible
      if (injuryEval.isInjured) {
        if (!injuryEval.isApproved) {
          continue; // Descartado: Lesión > 2 jornadas o precio fuera de rango
        }
      } else if (!isAvailable) {
        continue; // Sancionado o no disponible
      }

      // 2. Filtro de calidad general
      const expectedPoints = this.getExpectedPoints(player);
      const avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
      if (!injuryEval.isInjured && expectedPoints < 25 && avgPoints < 2.5 && player.price > 1500000) {
        continue;
      }

      // 3. Modificador por Calendario & Dificultad del Rival Inminente
      const calendarMod = this.getMatchDifficultyModifier(player, { opponent: player.nextOpponent || player.clubName || '' });
      const adjustedExpectedPoints = Math.round(expectedPoints * calendarMod);

      // 4. Evaluación de Squad Optimization (Mejora Real sobre el Mejor Once)
      const purchaseScore = calculateStrategicPurchaseScore(this, player, squad, balance, rivalIntel);
      const bidCalc = calculateMaxRationalBid(player, purchaseScore, balance, rivalIntel);

      let marginalValue = purchaseScore.marginalValue;
      const upgradePoints = marginalValue;
      const ppm = purchaseScore.performance.ppm;
      const efficiency = purchaseScore.performance.efficiency;

      // 🚫 REGLA ESTRICTA DE RIVALES HUMANOS (Sin clausulazo):
      // Solo tener en cuenta si el jugador aporta un Salto Cualitativo Real (+30 a +50 pts netos en temporada, marginalValue >= 8)
      if (!isComputer) {
        const qualifiesForRivalException = purchaseScore.entersXI && marginalValue >= 8;
        if (!qualifiesForRivalException) {
          continue; // Descartado: No alcanza el umbral de +30 a +50 pts de salto cualitativo
        }
      }

      // 5. Categorización racional
      let category = 'EL_RESTO';
      let impactTag = '⛔ EL RESTO (Sin Mejora Significativa)';

      if (injuryEval.isInjured && injuryEval.isApproved) {
        category = 'MEJORA_MODERADA';
        impactTag = `💎 GANGA ESPECULATIVA (Retorno: ${injuryEval.estimatedReturn})`;
      } else if (purchaseScore.entersXI && marginalValue >= 8) {
        category = 'SALTO_CUALITATIVO';
        impactTag = marginalValue >= 15 ? '🏆 SALTO CUALITATIVO ESTRELLA (+15 pts XI)' : '🚀 SALTO CUALITATIVO (+8 pts XI)';
      } else if (purchaseScore.entersXI || marginalValue >= 3 || purchaseScore.score >= 35) {
        category = 'MEJORA_MODERADA';
        impactTag = '📈 MEJORA TÁCTICA / ROTACIÓN';
      } else if (purchaseScore.score >= 20 || (player.price <= 1500000 && player.type === 'defender' && (player.average?.points >= 2.5 || expectedPoints >= 30))) {
        category = 'MEJORA_MODERADA';
        impactTag = '🛡️ FONDO DE ARMARIO / ROTACIÓN SÓLIDA';
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
   * Sugiere ventas inteligentes para ganar liquidez sin tocar a los pilares del equipo
   */
  getLiquiditySuggestions(squad, starting11Ids) {
    const currentSquad = squad?.players || [];
    const suggestions = [];

    currentSquad.forEach(p => {
      const price = p.price || 0;
      const totalPoints = p.totalPoints || 0;
      const seasonProj = this.getSeasonProjection(p);
      const isLinedUp = starting11Ids.includes(p.playerId || p.id);
      const isAvailable = this.isPlayerAvailable(p);
      const statusLower = ((p.status || '') + ' ' + (p.statusInfo || '')).toLowerCase();

      // PROTECCIÓN DE PILARES Y CRACKS: Nunca sugerir vender pilares
      if (price > 3000000 || seasonProj > 135 || totalPoints > 10) {
        return; // Intocable
      }
      
      // 1. Caso crítico: Lesionados graves de larga duración o sin ritmo (ej: Kike Barja)
      if (!isAvailable || statusLower.includes('baja') || statusLower.includes('cruzado') || statusLower.includes('rotura')) {
        suggestions.push({
          playerId: p.playerId || p.id,
          name: p.name,
          price: p.price,
          reason: `Sin minutos o en recuperación (${p.statusInfo || 'Baja'}). Vender libera ${p.price.toLocaleString()} € de tesorería.`
        });
      }
      // 2. Caso secundario: Parches suplentes prescindibles con 0 puntos
      else if (totalPoints === 0 && price < 1500000) {
        suggestions.push({
          playerId: p.playerId || p.id,
          name: p.name,
          price: p.price,
          reason: `Parche secundario sin minutos. Vender libera ${p.price.toLocaleString()} € para acometer fichajes titulares.`
        });
      }
    });

    return suggestions;
  }
}
