import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { ensurePlayerPhoto } from './imageGen.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const CLUB_CRESTS = {
  'Fermín Gadura F.C.': '/media/crests/fermin_gadura.svg',
  'Ana': '/media/crests/ana.svg',
  'Pachangueros F.C.': '/media/crests/pachangueros.svg',
  'Amigos de NIN': '/media/crests/amigos_de_nin.svg',
  'NIN Team': '/media/crests/amigos_de_nin.svg',
  'Puente Avios FC': '/media/crests/puente_avios.svg',
  'Puente Avios': '/media/crests/puente_avios.svg',
  'M4 TEAM': '/media/crests/m4_team.svg',
  'Melano Plabloroza': '/media/crests/melano_plabloroza.svg',
  'Suances nin': '/media/crests/suances_nin.svg',
  'Hache FC': '/media/crests/hache_fc.svg',
  'Racing de Oslo': '/media/crest.jpg'
};

export async function generateRivalsAuditData() {
  const client = new ComunioClient();
  const engine = new ComunioEngine();
  await client.login();
  const headers = client.getHeaders();

  console.log('[RIVALS-AUDIT] Descargando miembros y plantillas de los 10 clubes...');
  const membersRes = await axios.get(`https://api.comunio.es/communities/${client.communityId}/members`, { headers });
  const members = membersRes.data.members || [];
  const standings = await client.getStandings();
  const market = await client.getMarket();
  const marketPlayers = market?.players || [];

  // Parse historical transactions from news feed
  console.log('[RIVALS-AUDIT] Analizando histórico completo de traspasos y sobrepujas...');
  let transferNews = [];
  try {
    let start = 0;
    let keepGoing = true;
    while (keepGoing && start <= 600) {
      const newsUrl = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/news?start=${start}&limit=50`;
      const newsRes = await axios.get(newsUrl, { headers });
      const entries = newsRes.data?.newsList?.entries || [];
      if (entries.length === 0) break;
      transferNews.push(...entries);
      if (entries.length < 10) break;
      start += entries.length;
    }
    console.log(`[RIVALS-AUDIT] Total de noticias históricas recuperadas: ${transferNews.length}`);
  } catch (err) {
    console.warn('[RIVALS-AUDIT] No se pudieron obtener noticias para el histórico:', err.message);
  }

  // Regex para transacciones: <a ...>PLAYER</a> cambia por PRICE € de SELLER a BUYER.
  const txRegex = /<a[^>]*>([^<]+)<\/a>\s+cambia por\s+([\d\.]+)\s+€\s+de\s+(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?\s+a\s+(?:<a[^>]*>)?([^<\.]+?)(?:<\/a>)?\./g;

  // Mapear valor de mercado y puntos de todos los futbolistas conocidos
  const playerPriceMap = {};
  const playerPointsMap = {};
  marketPlayers.forEach(p => { 
    if (p.name) {
      playerPriceMap[p.name.toLowerCase().trim()] = parseInt(p.price || 0, 10);
      playerPointsMap[p.name.toLowerCase().trim()] = parseInt(p.points || 0, 10);
    }
  });

  for (const m of members) {
    try {
      const squadRes = await axios.get(`https://api.comunio.es/users/${m.id}/squad`, { headers });
      (squadRes.data?.items || []).forEach(p => {
        if (p.name) {
          playerPriceMap[p.name.toLowerCase().trim()] = parseInt(p.quotedprice || 0, 10);
          playerPointsMap[p.name.toLowerCase().trim()] = parseInt(p.points || 0, 10);
        }
      });
    } catch(e) {}
  }

  const lookupPoints = (playerName) => {
    if (!playerName) return 0;
    const low = playerName.toLowerCase().trim();
    if (playerPointsMap[low] !== undefined) return playerPointsMap[low];
    for (const [k, pts] of Object.entries(playerPointsMap)) {
      if (k.includes(low) || low.includes(k)) return pts;
    }
    return 0;
  };

  // Persistencia acumulativa de transferencias históricas (evita pérdida por ventana deslizante de la API)
  const txHistoryPath = path.resolve('web/src/data/historicalTransactions.json');
  let accumulatedTransactions = [];
  if (fs.existsSync(txHistoryPath)) {
    try {
      accumulatedTransactions = JSON.parse(fs.readFileSync(txHistoryPath, 'utf8'));
    } catch (e) {}
  }

  const managerStats = {};
  const knownTxKeys = new Set(accumulatedTransactions.map(t => `${t.playerName}_${t.price}_${t.seller}_${t.buyer}_${t.date.slice(0, 10)}`));

  // Normalizar nombres y alias de clubes / mánagers
  const norm = (n) => {
    if (!n) return n;
    const low = n.toLowerCase();
    if (low.includes('fermin') || low.includes('fermín')) return 'Fermín Gadura F.C.';
    if (low.includes('suances')) return 'Suances nin';
    if (low.includes('puente')) return 'Puente Avios FC';
    if (low.includes('melano')) return 'Melano Plabloroza';
    if (low.includes('hache')) return 'Hache FC';
    if (low.includes('m4')) return 'M4 TEAM';
    if (low.includes('amigos') || low.includes('nin')) return 'Amigos de NIN';
    if (low.includes('pachang') || low.includes('javilyon')) return 'Pachangueros F.C.';
    if (low.includes('ana')) return 'Ana';
    if (low.includes('racing') || low.includes('oslo') || low.includes('azfalot')) return 'Racing de Oslo';
    return n;
  };

  for (const e of transferNews) {
    const text = e.message?.text || '';
    let match;
    while ((match = txRegex.exec(text)) !== null) {
      const playerName = match[1].trim();
      const price = parseInt(match[2].replace(/\./g, ''), 10);
      let seller = norm(match[3].trim().replace(/\.$/, ''));
      let buyer = norm(match[4].trim().replace(/\.$/, ''));

      const txKey = `${playerName}_${price}_${seller}_${buyer}_${e.date.slice(0, 10)}`;
      if (!knownTxKeys.has(txKey)) {
        knownTxKeys.add(txKey);
        const vm = playerPriceMap[playerName.toLowerCase()] || price;
        const gain = vm - price;
        const gainPct = price > 0 ? parseFloat(((gain / price) * 100).toFixed(1)) : 0;
        const diff = price - vm;
        const pct = vm > 0 ? parseFloat(((diff / vm) * 100).toFixed(1)) : 0;

        accumulatedTransactions.push({
          playerName,
          price,
          marketValue: vm,
          gain,
          gainPct,
          diff,
          diffPct: pct,
          isOverbid: diff > 30000,
          isGain: gain > 30000,
          seller,
          buyer,
          date: e.date
        });
      }
    }
  }

  // Guardar histórico permanente acumulado
  fs.writeFileSync(txHistoryPath, JSON.stringify(accumulatedTransactions, null, 2));

  // Procesar compras y ventas agrupadas por club sobre todo el histórico acumulado
  for (const tx of accumulatedTransactions) {
    const buyer = tx.buyer;
    const seller = tx.seller;

    if (!managerStats[buyer]) {
      managerStats[buyer] = { purchases: [], sales: [], totalSpent: 0, totalReceived: 0, computerPurchases: 0 };
    }
    if (!managerStats[seller]) {
      managerStats[seller] = { purchases: [], sales: [], totalSpent: 0, totalReceived: 0, computerPurchases: 0 };
    }

    if (buyer !== 'Computer') {
      managerStats[buyer].purchases.push(tx);
      managerStats[buyer].totalSpent += tx.price;
      if (seller === 'Computer') managerStats[buyer].computerPurchases++;
    }
    if (seller !== 'Computer') {
      managerStats[seller].sales.push(tx);
      managerStats[seller].totalReceived += tx.price;
    }
  }

  const auditClubs = [];

  for (const m of members) {
    try {
      const squadRes = await axios.get(`https://api.comunio.es/users/${m.id}/squad`, { headers });
      const rawPlayers = squadRes.data.items || [];
      const teamName = m.firstName ? (m.firstName + ' ' + (m.lastName || '')).trim() : m.login;
      const std = standings.find(s => s.id === m.id) || {};
      const pos = standings.findIndex(s => s.id === m.id) + 1;
      const isMe = teamName.toLowerCase().includes('racing') || teamName.toLowerCase().includes('oslo');

      const squad = rawPlayers.map(p => ({
        playerId: p.id,
        name: p.name,
        type: p.position || p.type,
        position: p.position || p.type,
        price: p.quotedprice || 0,
        points: p.points || 0,
        image: `/media/players/${p.id}.png`
      }));

      // Asegurar descarga de fotos de jugadores clave
      for (const p of squad.slice(0, 8)) {
        await ensurePlayerPhoto(p.playerId);
      }

      const totalSquadValue = squad.reduce((sum, p) => sum + p.price, 0);
      const lineup = engine.optimizeLineup({ players: squad });

      // Clasificación de fortalezas y debilidades específicas
      const keepers = squad.filter(p => p.position === 'keeper');
      const defenders = squad.filter(p => p.position === 'defender');
      const midfielders = squad.filter(p => p.position === 'midfielder');
      const strikers = squad.filter(p => p.position === 'striker');

      const defVal = defenders.reduce((s, p) => s + p.price, 0);
      const midVal = midfielders.reduce((s, p) => s + p.price, 0);
      const atkVal = strikers.reduce((s, p) => s + p.price, 0);

      const strengths = [];
      const weaknesses = [];
      let financialHealth = '100% Saneado (Solvente)';
      let debtAlert = null;
      let tacticDescription = '';

      // Mapear estadísticas de especulación históricas
      const normKey = (tn) => {
        const low = tn.toLowerCase();
        if (low.includes('fermin') || low.includes('fermín')) return 'Fermín Gadura F.C.';
        if (low.includes('suances')) return 'Suances nin';
        if (low.includes('puente')) return 'Puente Avios FC';
        if (low.includes('melano')) return 'Melano Plabloroza';
        if (low.includes('hache')) return 'Hache FC';
        if (low.includes('m4')) return 'M4 TEAM';
        if (low.includes('amigos') || low.includes('nin')) return 'Amigos de NIN';
        if (low.includes('pachangueros')) return 'Pachangueros F.C.';
        if (low.includes('ana')) return 'Ana';
        if (low.includes('racing') || low.includes('oslo')) return 'Racing de Oslo';
        return tn;
      };

      const mKey = normKey(teamName);
      const mHistory = managerStats[mKey] || { purchases: [], sales: [], totalSpent: 0, totalReceived: 0, computerPurchases: 0 };

      // Contabilidad dinámica: Dotación inicial + Ventas + Premios de Jornada - Compras
      const INITIAL_BUDGET = 20000000;
      const PRIZE_PER_POINT = 10000;
      const pts = std.points || std.totalPoints || 0;
      const prizesEarned = pts * PRIZE_PER_POINT;
      const netTransfers = mHistory.totalReceived - mHistory.totalSpent;
      const estimatedCash = isMe ? 543389 : (INITIAL_BUDGET + netTransfers + prizesEarned);
      const maxCreditLimit = Math.round(totalSquadValue * 0.25);
      const netWealth = totalSquadValue + estimatedCash;

      // Cálculo Matemático Objetivo de Sobrepuja Media
      let totalVM = 0;
      let totalOverbidDiff = 0;
      (mHistory.purchases || []).forEach(b => {
        const vm = b.marketValue || b.price;
        totalVM += vm;
        if (b.price > vm) {
          totalOverbidDiff += (b.price - vm);
        }
      });
      const rawOverbidPct = totalVM > 0 ? ((totalOverbidDiff / totalVM) * 100) : 0;
      const overbidEstimate = `+${rawOverbidPct.toFixed(1)}%`;

      // Cálculo Matemático de Puntuación de Especulación Multi-Factorial (0 a 100)
      // Factores: 1. Volumen de capital rotado vs valor de plantilla | 2. Tasa de rotación de jugadores | 3. Sobrepuja media | 4. Riesgo de descubierto
      const totalTurnover = mHistory.totalSpent + mHistory.totalReceived;
      const turnoverRatio = totalSquadValue > 0 ? (totalTurnover / totalSquadValue) : 1;
      const txCount = mHistory.purchases.length + mHistory.sales.length;
      
      let debtRiskFactor = 0;
      if (estimatedCash < -5000000) {
        debtRiskFactor = 35;
      } else if (estimatedCash < 0) {
        debtRiskFactor = 20;
      } else if (estimatedCash < 1000000) {
        debtRiskFactor = 5;
      }

      // Ponderación precisa de perfil financiero y agresividad
      let calculatedScore = Math.round(
        (turnoverRatio * 15) +             // Volumen de dinero movido
        (txCount * 0.7) +                   // Frecuencia de compras y ventas
        (rawOverbidPct * 1.2) +             // % de sobreprecio pagado
        debtRiskFactor                      // Tensión de tesorería
      );

      const specScore = Math.max(8, Math.min(98, calculatedScore));

      // Asignación de Taxonomía Universal de Perfiles Trader & Futboleros (0 a 100)
      let financialBadge = '🏦 Banquero Suizo / Caja Fuerte';
      let badgeColor = '#10b981';
      let riskLevel = 'Bajo Riesgo (Solvente)';

      if (specScore >= 75) {
        financialBadge = estimatedCash < 0 ? '🦈 Tiburón Kamikaze / Deuda' : '🦈 Tiburón / Hiper-Trader';
        badgeColor = '#ef4444';
        riskLevel = 'Alto Riesgo (Apalancado)';
      } else if (specScore >= 50) {
        financialBadge = '🎰 Especulador de Mercado';
        badgeColor = '#f59e0b';
        riskLevel = 'Riesgo Moderado-Alto';
      } else if (specScore >= 25) {
        financialBadge = '📈 Inversor Táctico / Eficiente';
        badgeColor = '#3b82f6';
        riskLevel = 'Riesgo Moderado';
      } else {
        financialBadge = '🏦 Banquero Suizo / Caja Fuerte';
        badgeColor = '#10b981';
        riskLevel = 'Bajo Riesgo (Solvente)';
      }

      // Diagnóstico Financiero Dinámico
      if (estimatedCash < 0) {
        const debtAmount = Math.abs(estimatedCash);
        const creditPct = ((debtAmount / maxCreditLimit) * 100).toFixed(1);
        financialHealth = `Apalancado / Saldo Negativo (-${(debtAmount / 1000000).toFixed(2)}M €)`;
        debtAlert = `Saldo en descubierto (-${(debtAmount / 1000000).toFixed(2)}M €). Consume el ${creditPct}% del límite de crédito permitido (${(maxCreditLimit / 1000000).toFixed(2)}M €). Exige ventas antes de puntuar.`;
      } else if (estimatedCash < 1000000) {
        financialHealth = `Solvente Ajustado (+${(estimatedCash / 1000).toFixed(0)}k € en Caja)`;
        debtAlert = `Saldo positivo (+${(estimatedCash / 1000).toFixed(0)}k €). Fondo de maniobra en caja ajustado; compras superiores a 1.5M € exigen ventas previas.`;
      } else {
        financialHealth = `Saneado / Alta Liquidez (+${(estimatedCash / 1000000).toFixed(2)}M € en Caja)`;
        debtAlert = `Excelente remanente de liquidez (+${(estimatedCash / 1000000).toFixed(2)}M €) y solvencia plena para acudir a subastas sin deuda.`;
      }

      const specAnalysis = `Operativa histórica de ${mHistory.purchases.length} compras (${(mHistory.totalSpent/1000000).toFixed(1)}M €) y ${mHistory.sales.length} ventas (${(mHistory.totalReceived/1000000).toFixed(1)}M €). Dinero total rotado: ${(totalTurnover/1000000).toFixed(1)}M € con sobrepuja media de ${overbidEstimate}.`;

      // Hitos de Mercado Dinámicos: Fichaje Maestro (ROI), Mejor Ganga y Mayor Sobreprecio
      let smartBuy = null;
      let bestBuy = null;
      let worstMove = null;

      if (mHistory.purchases.length > 0) {
        // 1. Fichaje Maestro (ROI Deportivo: Puntos generados por millón invertido)
        // Criterios de Excelencia:
        // a) TITULAR en el 11 Inicial (en lineup.starting11)
        // b) Fichado antes de la última jornada disputada (ha competido defendiendo el club)
        // c) Rendimiento contrastado en puntos
        const j3EndTime = new Date('2026-09-01T23:59:59+02:00').getTime();
        const starterList = (lineup.starting11 || []);

        const purchasesWithRoi = mHistory.purchases.map(tx => {
          const lowName = tx.playerName.toLowerCase().trim();
          const pts = lookupPoints(tx.playerName);
          const costM = tx.price / 1000000;
          const roi = costM > 0 ? parseFloat((pts / costM).toFixed(2)) : 0;
          const txTime = new Date(tx.date || 0).getTime();
          const hasPlayedMatchdays = txTime > 0 && txTime <= j3EndTime;
          const isStarter = starterList.some(p => {
            const pLow = p.name.toLowerCase().trim();
            return pLow === lowName || pLow.includes(lowName) || lowName.includes(pLow);
          });
          
          return { ...tx, points: pts, roi, hasPlayedMatchdays, isStarter };
        });

        // Prioridad 1: Fichajes que se han ganado la TITULARIDAD en el 11 inicial con puntos
        const starterBuys = purchasesWithRoi.filter(b => b.isStarter && b.hasPlayedMatchdays && b.points > 0);
        // Prioridad 2: Jugadores que han disputado jornadas con el club
        const playedBuys = purchasesWithRoi.filter(b => b.hasPlayedMatchdays && b.points > 0);
        
        const candidatePool = starterBuys.length > 0 ? starterBuys : (playedBuys.length > 0 ? playedBuys : purchasesWithRoi);
        const sortedByRoi = [...candidatePool].sort((a, b) => b.roi - a.roi);
        const topRoiDeal = sortedByRoi.find(b => b.points > 0) || sortedByRoi[0];

        if (topRoiDeal && topRoiDeal.points > 0) {
          const isNewArrival = !topRoiDeal.hasPlayedMatchdays;
          const roleLabel = topRoiDeal.isStarter ? 'Titular en el 11' : 'Rotación';
          smartBuy = {
            player: topRoiDeal.playerName,
            price: topRoiDeal.price,
            points: topRoiDeal.points,
            roi: topRoiDeal.roi,
            impact: isNewArrival
              ? `Recién fichado por ${(topRoiDeal.price / 1000000).toFixed(2)}M € con ${topRoiDeal.points} pts en liga (${topRoiDeal.roi} pts/M€ potencial).`
              : `Pilar clave (${roleLabel}): Costó ${(topRoiDeal.price / 1000000).toFixed(2)}M € y suma ${topRoiDeal.points} pts con el club (${topRoiDeal.roi} pts/M€ invertido).`,
            tag: isNewArrival ? `⚡ ${topRoiDeal.roi} pts/M€ (Potencial)` : `🎯 ${topRoiDeal.roi} pts/M€ (Titular ROI)`
          };
        }

        // 2. Mayor Plusvalía / Revalorización Patrimonial
        const purchasesWithGain = mHistory.purchases.map(tx => {
          const currentVM = playerPriceMap[tx.playerName.toLowerCase()] || tx.marketValue || tx.price;
          const gain = currentVM - tx.price;
          const gainPct = tx.price > 0 ? parseFloat(((gain / tx.price) * 100).toFixed(1)) : 0;
          return { ...tx, currentVM, gain, gainPct };
        });

        const sortedByGain = [...purchasesWithGain].sort((a, b) => (b.gain || 0) - (a.gain || 0));
        const topGain = sortedByGain[0];

        if (topGain && topGain.gain > 30000) {
          bestBuy = {
            player: topGain.playerName,
            price: topGain.price,
            impact: `Fichado por ${(topGain.price / 1000000).toFixed(2)}M €, hoy cotiza en ${(topGain.currentVM / 1000000).toFixed(2)}M € (+${topGain.gain.toLocaleString()} € / +${topGain.gainPct}% de plusvalía).`,
            tag: `📈 +${topGain.gainPct}% Plusvalía`
          };
        } else {
          bestBuy = {
            player: topGain?.playerName || 'Estabilidad',
            price: topGain?.price || 0,
            impact: 'Operaciones ajustadas a cotización oficial sin minusvalías registradas.',
            tag: '💎 A Valor'
          };
        }

        // 3. Mayor Sobreprecio / Riesgo
        const sortedOverbids = [...mHistory.purchases].sort((a, b) => (b.diff || 0) - (a.diff || 0));
        const worstOverbid = sortedOverbids[0];
        if (worstOverbid && worstOverbid.diff > 50000) {
          worstMove = {
            player: worstOverbid.playerName,
            price: worstOverbid.price,
            impact: `Sobrepuja de +${(worstOverbid.diff).toLocaleString()} € (+${worstOverbid.diffPct}%) por encima de su cotización oficial.`,
            tag: '💥 Sobreprecio Registrado'
          };
        }
      }

      if (!smartBuy) {
        smartBuy = { player: 'Plantilla Base', price: 0, impact: 'Rendimiento sustentado en la asignación inicial de jugadores.', tag: 'Bloque Base' };
      }
      if (!bestBuy) {
        bestBuy = { player: 'Bloque Base', price: 0, impact: 'Mantiene la columna vertebral inicial sin compras registradas.', tag: 'Continuidad' };
      }
      if (!worstMove) {
        worstMove = { player: 'Gestión Controlada', price: 0, impact: 'Sin sobreprecios críticos ni minusvalías detectadas en sus operaciones.', tag: 'Riesgo Mínimo' };
      }

      const keyDeals = { smartBuy, bestBuy, worstMove };

      // Fortalezas y Debilidades Deportivas Basadas en Datos Reales
      if (pos <= 3) {
        strengths.push(`${pos}º en la clasificación general con ${pts} puntos acumulados (${(pts/3).toFixed(1)} pts/jornada).`);
      }
      if (totalSquadValue > 55000000) {
        strengths.push(`Patrimonio de plantilla consolidado en Primera (${(totalSquadValue/1000000).toFixed(2)}M €).`);
      }
      if (keepers.some(k => (k.points || 0) >= 15 || k.price > 4000000)) {
        strengths.push('Seguridad contrastada bajo palos en portería.');
      }
      if (midfielders.some(m => m.price > 10000000 || (m.points || 0) >= 20)) {
        strengths.push('Medular con futbolistas de jerarquía técnica y capacidad de puntuación.');
      }
      if (strikers.some(s => s.price > 15000000 || (s.points || 0) >= 30)) {
        strengths.push('Poderío goleador diferencial en ataque.');
      }

      if (squad.length < 13) {
        weaknesses.push(`Plantilla corta (${squad.length} jugadores) con escaso fondo de armario ante rotaciones.`);
      }
      if (strikers.length === 0 || strikers.reduce((sum, s) => sum + (s.points || 0), 0) < 15) {
        weaknesses.push('Baja producción goleadora de los delanteros en las 3 primeras jornadas.');
      }
      if (defenders.length < 4 || defVal < 8000000) {
        weaknesses.push('Línea defensiva con bajo valor de mercado o margen de mejora en solidez.');
      }
      if (estimatedCash < 0) {
        weaknesses.push(`Tensión de tesorería: Saldo negativo de -${(Math.abs(estimatedCash)/1000000).toFixed(2)}M € que obliga a vender piezas.`);
      }
      if (weaknesses.length === 0) {
        weaknesses.push('Plantilla equilibrada sujeta al rendimiento semanal en liga.');
      }
      if (strengths.length === 0) {
        strengths.push('Bloque combativo en fase de ajuste táctico.');
      }

      tacticDescription = `Estructura ${lineup.formation || '4-4-2'} orientada a maximizar ${Math.round(lineup.score || 40)} puntos según plantilla disponible.`;

      // Recomendaciones de Mercado Inteligentes y Personalizadas por Capacidad Económica y Perfil Táctico
      const recommendations = [];
      const posMap = { keeper: 'Portero', defender: 'Defensa', midfielder: 'Centrocampista', striker: 'Delantero' };
      const compMarket = marketPlayers.filter(mp => mp.owner?.name === 'Computer' || !mp.owner);

      // Jugadores de referencia del club para contexto táctico
      const topStar = squad.sort((a, b) => b.price - a.price)[0]?.name || 'el equipo';

      if (estimatedCash > 8000000) {
        // Club con liquidez masiva (>8M €) -> Cracks top de mercado (Yeremay / Mario Soriano / Canales)
        const topMid = compMarket.find(mp => (mp.name.includes('Yeremay') || mp.name.includes('Soriano') || mp.name.includes('Canales')) && !recommendations.some(r => r.name === mp.name));
        if (topMid) {
          recommendations.push({
            name: topMid.name,
            pos: posMap[topMid.position || topMid.type] || 'Centrocampista',
            price: topMid.price,
            reason: `Fichaje galáctico financiable con su liquidez (+${(estimatedCash/1000000).toFixed(1)}M €) para formar una medular intratable junto a ${topStar}.`
          });
        }
        const topDef = compMarket.find(mp => (mp.name.includes('Hinojo') || mp.name.includes('Galán')) && !recommendations.some(r => r.name === mp.name));
        if (topDef) {
          recommendations.push({
            name: topDef.name,
            pos: 'Defensa',
            price: topDef.price,
            reason: `Zaguero de primer nivel para blindar la retaguardia sin comprometer su remanente en caja.`
          });
        }
      } else if (estimatedCash > 2000000) {
        // Club con liquidez media (2M - 8M €) -> Jugadores de clase media consolidada (Galán, Hinojo, Durán)
        const medDef = compMarket.find(mp => (mp.name.includes('Galán') || mp.name.includes('Hinojo')) && !recommendations.some(r => r.name === mp.name));
        if (medDef) {
          recommendations.push({
            name: medDef.name,
            pos: 'Defensa',
            price: medDef.price,
            reason: `Refuerzo de jerarquía para el once titular asumiendo un desembolso perfectamente cubierto por su caja.`
          });
        }
        const medFwd = compMarket.find(mp => mp.name.includes('Durán') && !recommendations.some(r => r.name === mp.name));
        if (medFwd) {
          recommendations.push({
            name: medFwd.name,
            pos: 'Delantero',
            price: medFwd.price,
            reason: `Punta en racha para oxigenar el ataque y elevar la producción ofensiva semanal.`
          });
        }
      } else if (estimatedCash >= 0) {
        // Club solvente pero con caja ajustada (< 2M €) -> Fichajes quirúrgicos asequibles (Durán, Salinas, Enríquez, Novoa)
        const isOslo = mKey.includes('Racing') || mKey.includes('Oslo');
        if (isOslo) {
          const fwd = compMarket.find(mp => mp.name.includes('Durán'));
          if (fwd) {
            recommendations.push({
              name: fwd.name,
              pos: 'Delantero',
              price: fwd.price,
              reason: `Ariete asequible (${(fwd.price/1000000).toFixed(2)}M €) para generar competencia directa con Gerard Moreno y Hugo Duro.`
            });
          }
          const salinas = compMarket.find(mp => mp.name.includes('Salinas'));
          if (salinas) {
            recommendations.push({
              name: salinas.name,
              pos: 'Defensa',
              price: salinas.price,
              reason: `Carrilero zurdo de 1.0M € para rotar en el 3-4-3 y dar profundidad al lateral.`
            });
          }
          const enriquez = compMarket.find(mp => mp.name.includes('Enríquez'));
          if (enriquez) {
            recommendations.push({
              name: enriquez.name,
              pos: 'Centrocampista',
              price: enriquez.price,
              reason: `Volante de bajo coste (790k €) para ampliar el banquillo de 3 suplentes sin tensión de tesorería.`
            });
          }
        } else {
          const budgetDef = compMarket.find(mp => (mp.name.includes('Novoa') || mp.name.includes('Salinas')) && !recommendations.some(r => r.name === mp.name));
          if (budgetDef) {
            recommendations.push({
              name: budgetDef.name,
              pos: 'Defensa',
              price: budgetDef.price,
              reason: `Zaguero de bajo coste (${(budgetDef.price/1000).toFixed(0)}k €) para apuntalar la retaguardia sin forzar ventas.`
            });
          }
          const budgetMid = compMarket.find(mp => (mp.name.includes('Enríquez') || mp.name.includes('Josan')) && !recommendations.some(r => r.name === mp.name));
          if (budgetMid) {
            recommendations.push({
              name: budgetMid.name,
              pos: 'Centrocampista',
              price: budgetMid.price,
              reason: `Pieza de rotación económica para sostener el fondo de armario ante sanciones o rotaciones.`
            });
          }
        }
      } else {
        // Club en descubierto / apalancado (< 0 €) -> Parches a coste mínimo (< 400k €)
        const cheap1 = compMarket.find(mp => mp.name.includes('Novoa') || mp.name.includes('Josan'));
        if (cheap1) {
          recommendations.push({
            name: cheap1.name,
            pos: posMap[cheap1.position || cheap1.type] || 'Parche',
            price: cheap1.price,
            reason: `Incorporación a coste mínimo (${(cheap1.price/1000).toFixed(0)}k €) para cubrir puestos vacantes sin incrementar el descubierto en tesorería.`
          });
        }
        const cheap2 = compMarket.find(mp => (mp.name.includes('Letacek') || mp.name.includes('Diangana') || mp.name.includes('Sow')) && !recommendations.some(r => r.name === mp.name));
        if (cheap2) {
          recommendations.push({
            name: cheap2.name,
            pos: posMap[cheap2.position || cheap2.type] || 'Parche',
            price: cheap2.price,
            reason: `Ficha a precio simbólico (${(cheap2.price/1000).toFixed(0)}k €) para cumplir con el mínimo de 11 jugadores alineados.`
          });
        }
      }

      // Si tiene banquillo corto, añadir una pieza económica de fondo de armario
      if (squad.length < 14 && recommendations.length < 3) {
        const cheapExtra = compMarket.find(mp => mp.price > 150000 && mp.price < 800000 && !recommendations.some(r => r.name === mp.name));
        if (cheapExtra) {
          recommendations.push({
            name: cheapExtra.name,
            pos: posMap[cheapExtra.position || cheapExtra.type] || 'Fondo de Armario',
            price: cheapExtra.price,
            reason: `Fondo de armario económico (${(cheapExtra.price/1000).toFixed(0)}k €) para no quedarse sin cambios en caso de bajas imprevistas.`
          });
        }
      }

      auditClubs.push({
        id: m.id,
        teamName,
        manager: m.login,
        crest: CLUB_CRESTS[teamName] || '/media/crest.jpg',
        pos: pos > 0 ? pos : 10,
        points: std.points || std.totalPoints || 0,
        squadValue: totalSquadValue,
        playerCount: squad.length,
        financialHealth,
        debtAlert,
        projectedScore: Math.round(lineup.score || 38),
        formation: lineup.formation || '4-3-3',
        tacticDescription,
        strengths,
        weaknesses,
        recommendations,
        // Speculation & Overbid Metrics
        speculation: {
          score: specScore,
          badge: financialBadge,
          badgeColor: badgeColor,
          overbidRate: overbidEstimate,
          riskLevel: riskLevel,
          totalSpent: mHistory.totalSpent,
          totalReceived: mHistory.totalReceived,
          purchasesCount: mHistory.purchases.length,
          salesCount: mHistory.sales.length,
          estimatedCash: estimatedCash,
          prizesEarned: prizesEarned,
          maxCreditLimit: maxCreditLimit,
          netWealth: netWealth,
          analysis: specAnalysis
        },
        keyDeals,
        transfersHistory: {
          purchases: mHistory.purchases || [],
          sales: mHistory.sales || []
        },
        starters: (lineup.starting11 || []).map(p => ({
          id: p.playerId || p.id,
          name: p.name,
          position: p.type || p.position,
          price: p.price || 0,
          points: p.points || 0,
          expectedPoints: p.expectedPoints || 3.5,
          image: `/media/players/${p.playerId || p.id}.png`
        })),
        bench: (lineup.bench || []).map(p => ({
          id: p.playerId || p.id,
          name: p.name,
          position: p.type || p.position,
          price: p.price || 0,
          points: p.points || 0,
          image: `/media/players/${p.playerId || p.id}.png`
        })),
        isMe
      });
    } catch (err) {
      console.warn(`[RIVALS-AUDIT] Error procesando equipo de ${m.login}:`, err.message);
    }
  }

  auditClubs.sort((a, b) => a.pos - b.pos);
  const outPath = path.resolve('web/src/data/rivalsAudit.json');
  fs.writeFileSync(outPath, JSON.stringify(auditClubs, null, 2));
  console.log(`[RIVALS-AUDIT] ✅ rivalsAudit.json generado con éxito con métricas de especulación.`);
  await client.close();
}

generateRivalsAuditData();

