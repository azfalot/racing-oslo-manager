/**
 * Motor de Inteligencia y Toma de Decisiones para Comunio
 */

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

    const opponent = ((matchData.opponent || matchData.rival || '').toLowerCase());
    const isAway = Boolean(matchData.isAway || matchData.away);

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

    // Partido favorable en casa (Bonus +10%)
    if (!isAway && (opponent.includes('alaves') || opponent.includes('elche') || opponent.includes('valladolid') || opponent.includes('cadiz') || opponent.includes('granada'))) {
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

    // 1. Intentar usar promedio de puntos por partido reciente de la temporada actual
    const avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
    if (!isNaN(avgPoints) && avgPoints > 0) {
      baseScore = Math.round(avgPoints * 25);
    }
    
    // 2. Usar histórico de temporadas anteriores (evalúa la mejor temporada válida con puntos para no infravalorar cracks)
    const historyList = Array.isArray(player.historical)
      ? player.historical
      : (player.historical?.points || player.historicalPoints || []);

    if (historyList.length > 0) {
      const validPoints = historyList.map(h => parseInt(h.points) || 0).filter(p => p > 0);
      if (validPoints.length > 0) {
        const bestHistoricalPoints = Math.max(...validPoints);
        baseScore = Math.max(baseScore, bestHistoricalPoints);
      }
    }

    // Fallback a estimación por valor de mercado si no hay registros
    if (baseScore === 0) {
      const price = player.price || 0;
      if (price > 5000000) baseScore = 120;
      else if (price > 2000000) baseScore = 80;
      else if (price > 1000000) baseScore = 40;
      else baseScore = 15;
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

    const statusLower = ((player.status || '') + ' ' + (player.statusInfo || '') + ' ' + (player.availability || '')).toLowerCase();
    
    // Lista ampliada de estados no disponibles o con alto riesgo de 0 puntos (duda, debilitado, cirugía, molestias)
    const unavailableKeywords = [
      'injured', 'suspended', 'rehabilitation', 'retired', 'away',
      'lesionado', 'sancionado', 'baja', 'duda', 'debilitado',
      'molestias', 'cirugia', 'cirugía', 'quirófano', 'hombro', 'rotura'
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

    const players = squad.players.map(p => ({
      ...p,
      expectedPoints: this.getExpectedPoints(p),
      available: this.isPlayerAvailable(p)
    }));

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
   * Determina si se debe poner en venta a un jugador ÚNICAMENTE tras haber completado el fichaje de un reemplazo superior.
   * Regla: Solo se vende al PEOR jugador de esa posición cuando el nuevo fichaje supera su nivel histórico.
   */
  evaluateSaleTriggerAfterSigning(newSigning, squad) {
    const currentSquad = squad?.players || [];
    const pos = newSigning.type || newSigning.position;
    
    // Filtrar jugadores de la misma posición
    const samePositionPlayers = currentSquad.filter(p => (p.type || p.position) === pos);
    
    if (samePositionPlayers.length === 0) {
      return { shouldListForSale: false, reason: 'No hay suficientes jugadores en la posición para vender.' };
    }

    // Ordenar de menor a mayor histórico (el peor de la posición es el primero)
    const sortedPosition = [...samePositionPlayers].sort((a, b) => this.getExpectedPoints(a) - this.getExpectedPoints(b));
    const worstPlayer = sortedPosition[0];

    const newSigningScore = this.getExpectedPoints(newSigning);
    const worstPlayerScore = this.getExpectedPoints(worstPlayer);

    // Solo poner a la venta si el nuevo fichaje es SUPERIOR al peor de la posición
    if (newSigningScore > worstPlayerScore) {
      return {
        shouldListForSale: true,
        playerToList: worstPlayer,
        reason: `🎯 VENTA AUTORIZADA TRAS FICHAJE: Se ha fichado a ${newSigning.name} (${newSigningScore} pts históricos), que mejora la posición. Se pone a la venta ÚNICAMENTE al peor de la posición (${worstPlayer.name}, ${worstPlayerScore} pts) para recuperar inversión.`
      };
    }

    return {
      shouldListForSale: false,
      reason: `⛔ NO SE PONE A LA VENTA: El nuevo fichaje (${newSigningScore} pts) no supera la exigencia requerida.`
    };
  }

  /**
   * Evalúa una oferta de venta recibida por un jugador de nuestra plantilla.
   * Reglas estrictas:
   * 1. Comparación de Múltiples Ofertas: Seleccionar SIEMPRE la oferta de MAYOR IMPORTE.
   * 2. Protección de Rivales: Preferir la Computadora sobre un rival humano si la oferta es igual o mayor.
   * 3. Evaluación Táctica: Si el jugador es Titular Indiscutible (Top 1-2 de su posición) y el saldo no es negativo, RECHAZAR.
   * 4. Rentabilidad Financiera: Solo vender si la oferta supera el valor de mercado (VM) o resuelve saldo negativo urgente.
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

    const marketValue = player.quotedPrice || player.price || 0;
    const isProfitable = chosenOffer.price >= marketValue;
    const isComputer = chosenOffer.user?.id === 1 || (chosenOffer.user?.name && chosenOffer.user.name.toLowerCase().includes('computer'));

    // 2. Verificar si es un titular imprescindible o un jugador clave (>= 130 pts)
    const bestLineup = this.optimizeLineup(squad);
    const isStarter = bestLineup.starting11.some(p => p.playerId === player.id || p.playerId === player.playerId);
    const expectedPoints = this.getExpectedPoints(player);

    // Si es un titular clave o jugador estelar (>= 130 pts) y NO tenemos saldo negativo urgente, RECHAZAR VENTA AUTOMÁTICA
    if ((isStarter || expectedPoints >= 130) && currentBalance >= 0) {
      return {
        shouldAccept: false,
        chosenOffer,
        reason: `⛔ RECHAZADA AUTOMÁTICAMENTE: ${player.name} (~${expectedPoints} pts) es una pieza clave de tu equipo y el club tiene saldo positivo (${currentBalance.toLocaleString()} €). No se vende a jugadores top.`
      };
    }

    // Si la oferta proviene de un rival humano y ofrece menos o igual que la Computadora
    if (!isComputer && computerOffer && bestOffer.price <= computerOffer.price) {
      chosenOffer = computerOffer; // Forzar venta a Computer para no dar el jugador al rival
    }

    // 3. Aceptar si es rentable o si necesitamos liquidar deuda
    if (isProfitable || currentBalance < 0) {
      return {
        shouldAccept: true,
        chosenOffer,
        reason: `✅ ACEPTADA: Venta estratégica de ${player.name} a ${chosenOffer.user?.name || 'Mercado'} por ${chosenOffer.price.toLocaleString()} € (+${(chosenOffer.price - marketValue).toLocaleString()} € sobre VM).`
      };
    }

    return {
      shouldAccept: false,
      chosenOffer,
      reason: `⛔ RECHAZADA: La oferta (${chosenOffer.price.toLocaleString()} €) no alcanza el valor de mercado (${marketValue.toLocaleString()} €).`
    };
  }

  /**
   * Analiza el mercado de fichajes y sugiere las mejores compras
   */
  analyzeMarket(marketPlayers, squad, balance) {
    if (!marketPlayers || marketPlayers.length === 0) {
      return { recommendations: [], message: 'No hay jugadores en el mercado para analizar.' };
    }

    const currentSquad = squad?.players || [];
    // Identificar el mejor XI actual para comparar los fichajes del mercado contra los titulares
    const currentLineup = this.optimizeLineup(squad);
    const starters = currentLineup.starting11 || [];

    const myWeakestStarterByPos = {
      keeper: this.getWeakestPlayer(starters, 'keeper'),
      defender: this.getWeakestPlayer(starters, 'defender'),
      midfielder: this.getWeakestPlayer(starters, 'midfielder'),
      striker: this.getWeakestPlayer(starters, 'striker')
    };

    const recommendations = [];

    // Colchón de seguridad financiera: Mantener al menos 1M € o el 15% del saldo disponible
    const safetyReserve = Math.max(1000000, Math.round(balance * 0.15));
    const maxExpenditure = balance - safetyReserve;

    for (const player of marketPlayers) {
      const pid = parseInt(player.playerId || player.id);

      // 1. Exclusión estricta: Jamás ofrecer nuestros propios jugadores puestos en el mercado
      if (mySquadIds.has(pid)) continue;
      if (player.owner?.id && squad?.userId && player.owner.id === squad.userId) continue;

      const ownerName = (player.owner?.name || 'Computer').trim();
      const isComputer = player.owner?.id === 1 || ownerName.toLowerCase() === 'computer';

      const expectedPoints = this.getExpectedPoints(player);
      const isAvailable = this.isPlayerAvailable(player);
      
      if (!isAvailable) continue; // Ignorar lesionados o sancionados del mercado

      // 2. Filtro de calidad general: exigir un rendimiento medio mínimo (~3.0 pts/partido o 25 pts de base esperada)
      const avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
      if (expectedPoints < 25 && avgPoints < 3.0 && player.price > 1500000) {
        continue; // Descartar parches o futbolistas con rendimiento mediocre y precio inflado
      }

      // 3. Aplicar Modificador por Calendario & Dificultad del Rival Inminente
      const calendarMod = this.getMatchDifficultyModifier(player, { opponent: player.nextOpponent || player.clubName || '' });
      const adjustedExpectedPoints = Math.round(expectedPoints * calendarMod);

      // Puntos por millón (PPM)
      const ppm = adjustedExpectedPoints / (player.price / 1000000);

      // Comparar con el titular más débil que tenemos en esa posición
      const myWeakestStarter = myWeakestStarterByPos[player.type];
      let upgradePoints = adjustedExpectedPoints;

      if (myWeakestStarter) {
        const myWeakestPoints = this.getExpectedPoints(myWeakestStarter);
        upgradePoints = adjustedExpectedPoints - myWeakestPoints;
      }

      // 4. Categorizar según la directiva de alta exigencia de mercado:
      // SALTO_CUALITATIVO: mejora >= 35 pts (Jugadores estrella que garantizan salto real)
      // MEJORA_MODERADA: 20 <= mejora < 35 pts (Mejora secundaria significativa)
      // EL_RESTO: mejora < 20 pts (Suprimido 100% en Telegram para evitar exceso de notificaciones)
      let category = 'EL_RESTO';
      let impactTag = '⛔ EL RESTO (Sin Mejora Significativa)';

      if (upgradePoints >= 35) {
        category = 'SALTO_CUALITATIVO';
        impactTag = upgradePoints >= 50 ? '🏆 SALTO CUALITATIVO ESTRELLA (+50 pts)' : '🚀 SALTO CUALITATIVO (+35 pts)';
      } else if (upgradePoints >= 20) {
        // Exigir estado de forma positivo esta temporada (PPM >= 3.2 o racha reciente) para ocupar plaza de Suplente de Refresco
        const isGoodForm = avgPoints >= 3.2 || (player.totalPoints && player.totalPoints > 30);
        if (isGoodForm) {
          category = 'MEJORA_MODERADA';
          impactTag = '📈 MEJORA MODERADA EN FORMA (Suplente de Refresco +20 pts)';
        } else {
          category = 'EL_RESTO'; // Descartar si el jugador está fuera de forma en la temporada en curso
        }
      }

      // 5. Protección económica y control de plantilla (15 jugadores máx)
      const canAffordSafely = player.price <= maxExpenditure || (balance >= player.price && category === 'SALTO_CUALITATIVO');
      const isSquadFull = currentSquad.length >= 15;

      if (category !== 'EL_RESTO' && canAffordSafely) {
        const bidAmount = player.price; // Puja mínima por defecto

        recommendations.push({
          playerId: pid,
          name: player.name,
          type: player.type,
          price: player.price,
          bidAmount,
          expectedPoints,
          ppm: parseFloat(ppm.toFixed(2)),
          upgradePoints,
          category, // SALTO_CUALITATIVO o MEJORA_MODERADA
          impactTag,
          ownerName,
          isComputer,
          requiresSaleFirst: isSquadFull,
          reason: myWeakest 
            ? `${impactTag}: +${upgradePoints.toFixed(0)} pts esperados sobre tu peor ${player.type} (${myWeakest.name}).`
            : `${impactTag}: Cubre posición vacía de ${player.type} con ${expectedPoints.toFixed(0)} pts esperados.`
        });
      }
    }

    // Ordenar recomendaciones: primero los fichajes de mayor impacto (+30 a +50 pts)
    recommendations.sort((a, b) => b.upgradePoints - a.upgradePoints);

    // Identificar la mejor oferta del mercado en relación Calidad-Precio (Chollo / Bajo coste + Alto rendimiento)
    let bestValueOffer = null;
    if (recommendations.length > 0) {
      const sortedByPPM = [...recommendations].sort((a, b) => b.ppm - a.ppm);
      bestValueOffer = sortedByPPM[0];
      if (bestValueOffer) {
        bestValueOffer.isBestValue = true;
      }
    }

    return {
      recommendations,
      bestValueOffer,
      message: `Se han encontrado ${recommendations.length} oportunidades de fichaje recomendadas.`
    };
  }

  /**
   * Gestiona la economía y calcula qué jugadores vender en caso de deuda
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

    console.log(`[ENGINE] Alerta de Deuda: Tu balance es de ${balance}. Debes vender jugadores por valor de ${report.requiredSalesValue} antes de que comience la jornada.`);

    // Estrategia de venta:
    // Clasificar jugadores de la plantilla según su ratio puntos/valor (PPM) ascendente.
    // Los que tengan menor PPM (alto precio y pocos puntos, o lesionados) serán los primeros candidatos a vender.
    const saleCandidates = currentSquad.map(p => {
      const expectedPoints = this.getExpectedPoints(p);
      const isAvailable = this.isPlayerAvailable(p);
      const ppm = expectedPoints / (p.price / 1000000);
      
      // Multiplicar por 0.1 los puntos esperados si está lesionado a largo plazo para priorizar su venta
      const scoreWeight = isAvailable ? expectedPoints : (expectedPoints * 0.1);
      const priorityMetric = scoreWeight / (p.price / 1000000); // Menor valor = mejor candidato de venta

      return {
        ...p,
        expectedPoints,
        isAvailable,
        ppm,
        priorityMetric
      };
    }).sort((a, b) => a.priorityMetric - b.priorityMetric); // De menor a mayor rendimiento de dinero

    let accumulatedValue = 0;
    for (const player of saleCandidates) {
      if (accumulatedValue >= report.requiredSalesValue) break;

      accumulatedValue += player.price;
      report.suggestedSales.push({
        playerId: player.playerId,
        name: player.name,
        type: player.type,
        price: player.price,
        isAvailable: player.isAvailable,
        reason: !player.isAvailable 
          ? `Lesionado o no disponible, liberando ${player.price.toLocaleString()}€`
          : `Bajo rendimiento por millón de euros (PPM: ${player.ppm.toFixed(2)}).`
      });
    }

    report.message = `¡ALERTA! Tienes una deuda de ${balance.toLocaleString()}€. Para solucionarlo antes del inicio de la jornada, se sugiere poner en venta a los siguientes ${report.suggestedSales.length} jugadores.`;
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
