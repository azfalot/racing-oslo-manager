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
   * Calcula la puntuación de calidad / valor de un jugador
   * Utiliza puntos actuales, promedio o histórico para dar robustez en pretemporada
   */
  getExpectedPoints(player) {
    // 1. Usar histórico de temporadas anteriores (soporta array o player.historical.points)
    const historyList = Array.isArray(player.historical)
      ? player.historical
      : (player.historical?.points || []);

    if (historyList.length > 0) {
      const history = [...historyList].sort((a, b) => b.season.localeCompare(a.season));
      const lastSeasonPoints = parseInt(history[0].points);
      if (!isNaN(lastSeasonPoints) && lastSeasonPoints > 0) {
        return lastSeasonPoints;
      }
    }

    // 2. Intentar usar promedio de puntos por partido
    const avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
    if (!isNaN(avgPoints) && avgPoints > 0) {
      return avgPoints * 10;
    }

    // 3. Puntos totales de esta temporada
    const currentPoints = parseInt(player.totalPoints);
    if (!isNaN(currentPoints) && currentPoints > 0) {
      return currentPoints * 5;
    }

    // 4. Puntuación por defecto si no hay datos
    return 10; 
  }

  /**
   * Determina si un jugador está activo y disponible
   */
  isPlayerAvailable(player) {
    if (!player.status) return true;
    
    // Lista de estados no disponibles (lesionados, sancionados, etc.)
    const statusLower = player.status.toLowerCase();
    const unavailableStatus = ['injured', 'suspended', 'rehabilitation', 'retired', 'away', 'lesionado', 'sancionado', 'baja'];
    
    return !unavailableStatus.some(s => statusLower.includes(s));
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

    // 2. Verificar si es un titular imprescindible en la alineación actual
    const bestLineup = this.optimizeLineup(squad);
    const isStarter = bestLineup.starting11.some(p => p.playerId === player.id || p.playerId === player.playerId);

    // Si es un titular clave y NO tenemos saldo negativo urgente, RECHAZAR
    if (isStarter && currentBalance >= 0) {
      return {
        shouldAccept: false,
        chosenOffer,
        reason: `⛔ RECHAZADA: ${player.name} es titular indiscutible en el XI titular y el club tiene saldo positivo (${currentBalance.toLocaleString()} €). No se desmantela la plantilla.`
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
    const myWeakestByPos = {
      keeper: this.getWeakestPlayer(currentSquad, 'keeper'),
      defender: this.getWeakestPlayer(currentSquad, 'defender'),
      midfielder: this.getWeakestPlayer(currentSquad, 'midfielder'),
      striker: this.getWeakestPlayer(currentSquad, 'striker')
    };

    const recommendations = [];

    for (const player of marketPlayers) {
      // Solo interesan jugadores que venda la Computadora (nuevos en el mercado)
      if (player.owner?.name !== 'Computer') continue;

      const expectedPoints = this.getExpectedPoints(player);
      const isAvailable = this.isPlayerAvailable(player);
      
      if (!isAvailable) continue; // Ignorar lesionados o sancionados del mercado

      // Puntos por millón (PPM)
      const ppm = expectedPoints / (player.price / 1000000);

      // Comparar con el jugador más débil que tenemos en esa posición
      const myWeakest = myWeakestByPos[player.type];
      let upgradePoints = expectedPoints;
      let isUpgrade = true;

      if (myWeakest) {
        const myWeakestPoints = this.getExpectedPoints(myWeakest);
        upgradePoints = expectedPoints - myWeakestPoints;
        isUpgrade = upgradePoints > 0;
      }

      // Si es una mejora y podemos permitírnoslo con nuestro saldo
      if (isUpgrade && player.price <= balance) {
        const bidAmount = player.price; // Siempre pujamos al mínimo (sin sobrevalorar)

        recommendations.push({
          playerId: player.playerId,
          name: player.name,
          type: player.type,
          price: player.price,
          bidAmount,
          expectedPoints,
          ppm: parseFloat(ppm.toFixed(2)),
          upgradePoints,
          reason: myWeakest 
            ? `Mejora tu peor ${player.type} (${myWeakest.name}) en +${upgradePoints.toFixed(0)} puntos esperados.`
            : `Cubre posición vacía de ${player.type} con ${expectedPoints.toFixed(0)} puntos esperados.`
        });
      }
    }

    // Ordenar recomendaciones: primero los upgrades que aportan más puntos esperados
    recommendations.sort((a, b) => b.upgradePoints - a.upgradePoints);

    return {
      recommendations,
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
