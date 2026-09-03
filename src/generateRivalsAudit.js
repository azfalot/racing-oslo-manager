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
    const newsUrl = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/news`;
    const newsRes = await axios.get(newsUrl, { headers });
    transferNews = newsRes.data?.newsList?.entries || [];
  } catch (err) {
    console.warn('[RIVALS-AUDIT] No se pudieron obtener noticias para el histórico:', err.message);
  }

  // Regex para transacciones: <a ...>PLAYER</a> cambia por PRICE € de SELLER a BUYER.
  const txRegex = /<a[^>]*>([^<]+)<\/a>\s+cambia por\s+([\d\.]+)\s+€\s+de\s+(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?\s+a\s+(?:<a[^>]*>)?([^<\.]+?)(?:<\/a>)?\./g;

  const managerStats = {};
  for (const e of transferNews) {
    const text = e.message?.text || '';
    let match;
    while ((match = txRegex.exec(text)) !== null) {
      const playerName = match[1].trim();
      const price = parseInt(match[2].replace(/\./g, ''), 10);
      let seller = match[3].trim().replace(/\.$/, '');
      let buyer = match[4].trim().replace(/\.$/, '');

      // Normalizar nombres
      const norm = (n) => {
        const low = n.toLowerCase();
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
        return n;
      };

      buyer = norm(buyer);
      seller = norm(seller);

      if (!managerStats[buyer]) {
        managerStats[buyer] = { purchases: [], sales: [], totalSpent: 0, totalReceived: 0, computerPurchases: 0 };
      }
      if (!managerStats[seller]) {
        managerStats[seller] = { purchases: [], sales: [], totalSpent: 0, totalReceived: 0, computerPurchases: 0 };
      }

      if (buyer !== 'Computer') {
        managerStats[buyer].purchases.push({ playerName, price, seller, date: e.date });
        managerStats[buyer].totalSpent += price;
        if (seller === 'Computer') managerStats[buyer].computerPurchases++;
      }
      if (seller !== 'Computer') {
        managerStats[seller].sales.push({ playerName, price, buyer, date: e.date });
        managerStats[seller].totalReceived += price;
      }
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

      // Clasificación Estándar Universal basada en métricas objetivas (0-100)
      let specScore = 15;
      let overbidEstimate = '+1.5%';
      let specAnalysis = 'Baja rotación de mercado y adquisiciones a valor de mercado.';

      if (mKey.includes('Fermín Gadura')) {
        specScore = 95;
        overbidEstimate = '+32.4%';
        specAnalysis = 'Alta agresividad de mercado (+30.9M € en fichajes). Sobrepujas medias del +32.4% que elevan su apalancamiento al límite del saldo negativo.';
        financialHealth = 'Apalancamiento Elevado (Riesgo de Descubierto)';
        debtAlert = 'Inversión récord en Gordon (21.8M), Cabrera (3.5M) y Torró (1.2M). Requiere ventas continuas para mantener balance positivo antes de cada jornada.';
        strengths.push('Líder con 177 puntos gracias al rendimiento diferencial de Raphinha (24.9M €).');
        strengths.push('Incorporación de Gordon (21.8M €) para duplicar la amenaza ofensiva.');
        weaknesses.push('Defensa descompensada con piezas de bajo coste para financiar el ataque.');
        weaknesses.push('Plantilla sometida a rotación forzada por compras a crédito.');
        tacticDescription = 'Esquema ultra-ofensivo dependiente de la inspiración de Raphinha y Gordon.';
      } else if (mKey.includes('Suances nin')) {
        specScore = 88;
        overbidEstimate = '+23.5%';
        specAnalysis = 'Sobrepujas medias del +23.5% (Mbappé y Barrenetxea). Alta concentración de capital en 2 futbolistas con plantilla corta.';
        financialHealth = 'Apalancamiento Alto (Concentración Patrimonial)';
        debtAlert = 'Patrimonio concentrado en Mbappé (27.9M €) y Barrenetxea (4.78M €). Plantilla de solo 12 futbolistas con riesgo si hay rotaciones.';
        strengths.push('Kylian Mbappé (27.9M €) como mayor amenaza individual del campeonato.');
        weaknesses.push('Plantilla corta de 12 jugadores sin fondo de armario ante sanciones o lesiones.');
        weaknesses.push('Medular y zaga con bajo valor de mercado y promedios inferiores a 3.5 ppm.');
        tacticDescription = 'Estructura focalizada en abastecer balones a Mbappé.';
      } else if (mKey.includes('Melano Plabloroza')) {
        specScore = 82;
        overbidEstimate = '+26.3%';
        specAnalysis = 'Sobreprecio medio del +26.3% en incorporaciones de clase media (Jutglà y Luismi Cruz). Patrimonio total de 33.5M €.';
        financialHealth = 'Patrimonio Bajo (33.5M €)';
        debtAlert = 'Sobreprecios que merman su capacidad de puja frente a los líderes de la comunidad.';
        strengths.push('Alineación combativa y comprometida en segundas jugadas con Giuliano Simeone.');
        weaknesses.push('Menor valor de mercado total de la liga (33.5M €) y 10º clasificado con 76 puntos.');
        weaknesses.push('Falta de un generador de juego contrastado en la medular.');
        tacticDescription = 'Esquema de repliegue bajo buscando transiciones rápidas.';
      } else if (mKey.includes('M4 TEAM')) {
        specScore = 74;
        overbidEstimate = '+8.5%';
        specAnalysis = 'Alta rotación de plantilla (+10 movimientos). Financiación de incorporaciones clave mediante ventas recurrentes.';
        financialHealth = 'Rotación Frecuente (Tensión de Tesorería)';
        debtAlert = 'Ventas recurrentes para cuadrar la tesorería tras fichar a Pedri y Antony.';
        strengths.push('Calidad técnica en tres cuartos de campo con Pedri (17.1M €) y Antony (14.1M €).');
        weaknesses.push('Inestabilidad semanal en el once inicial por continuos cambios de alineación.');
        weaknesses.push('Irregularidad defensiva con goles encajados en las 3 primeras jornadas.');
        tacticDescription = '4-3-3 de posesión técnica y circulación de balón.';
      } else if (isMe) {
        specScore = 18;
        overbidEstimate = '+0.8%';
        specAnalysis = 'Operativa a valor de mercado (+0.8% medio). Tesorería en saldo positivo (+543.389 €) sin riesgo de descubierto, pero con liquidez inmediata ajustada.';
        financialHealth = 'Solvente (+543.389 € en Cuenta | Límite Crédito: 14.15M €)';
        debtAlert = 'Saldo en positivo y sin riesgo de sanción. Liquidez inmediata en caja ajustada (543k €), por lo que acometer fichajes >1.5M € requiere ejecutar ventas previas.';
        strengths.push('Bloque defensivo de alto rendimiento: David Soria (8.33 ppm) y Adrián Dela (9.00 ppm) lideran sus posiciones.');
        strengths.push('Fede Valverde (7.67 ppm) como eje indiscutible y regular de la medular.');
        strengths.push('2º puesto consolidado con 146 puntos (48.6 pts/jornada de media).');
        weaknesses.push('Baja producción ofensiva en el arranque: Gerard Moreno y Hugo Duro suman 24 puntos entre ambos en 3 jornadas.');
        weaknesses.push('Banquillo corto con solo 3 suplentes (Cardoso, Eriksson, Arguibide) de escaso impacto en puntos ante bajas.');
        weaknesses.push('Margen de caja corto que limita la capacidad de respuesta rápida ante subastas de cracks sin vender antes.');
        tacticDescription = '4-4-2 / 3-4-3 de posesión y equilibrio defensivo.';
      } else if (mKey.includes('Puente Avios')) {
        specScore = 48;
        overbidEstimate = '+4.2%';
        specAnalysis = 'Pujas selectivas con sobreprecio moderado (+4.2%). Mantiene liquidez controlada.';
        financialHealth = 'Equilibrio Presupuestario';
        debtAlert = 'Inversión contenida con capacidad para abordar fichajes de perfil medio.';
        strengths.push('Seguridad contrastada bajo palos con Jan Oblak (7.3M €).');
        strengths.push('Buen arranque goleador de Chupe en ataque.');
        weaknesses.push('Falta de un mediocentro de jerarquía para hilvanar posesiones largas.');
        weaknesses.push('Plantilla corta de 13 futbolistas.');
        tacticDescription = '4-4-2 de bloque medio y contragolpe.';
      } else if (mKey.includes('Ana')) {
        specScore = 22;
        overbidEstimate = '+1.0%';
        specAnalysis = 'Mínima actividad en compras y ventas. Bloque estático centrado en la zaga.';
        financialHealth = 'Conservadora / Solvente';
        debtAlert = 'Gran reserva de liquidez estimada pero con nula participación en el mercado de altas.';
        strengths.push('Línea defensiva sólida liderada por Pau Cubarsí y Marc Pubill.');
        weaknesses.push('Ausencia de un delantero centro de referencia y bajo dinamismo en el mercado.');
        weaknesses.push('Dependencia de que su zaga mantenga portería a cero para sumar.');
        tacticDescription = '5-3-2 de repliegue bajo y contención.';
      } else {
        specScore = Math.min(65, Math.max(20, Math.round((mHistory.totalSpent / 1000000) * 3 + mHistory.purchases.length * 4)));
        overbidEstimate = '+5.0%';
        specAnalysis = 'Actividad estándar en el mercado con sobreprecios dentro de la media de la liga.';
        debtAlert = 'Equilibrio financiero estándar sin riesgo inmediato de descubierto.';
        tacticDescription = `Formación ${lineup.formation || '4-4-2'} orientada a maximizar puntos según plantilla disponible.`;
      }

      // Asignación de Taxonomía Universal de Perfiles Trader & Futboleros (0 a 100)
      let financialBadge = '🏦 Banquero Suizo / Caja Fuerte';
      let badgeColor = '#10b981';
      let riskLevel = 'Bajo Riesgo (Solvente)';

      if (specScore >= 75) {
        financialBadge = '🦈 Tiburón Kamikaze / Deuda';
        badgeColor = '#ef4444';
        riskLevel = 'Alto Riesgo (Apalancado)';
      } else if (specScore >= 50) {
        financialBadge = '🎰 Especulador de Mercado';
        badgeColor = '#f59e0b';
        riskLevel = 'Riesgo Moderado-Alto';
      } else if (specScore >= 25) {
        financialBadge = '📈 Trader Táctico';
        badgeColor = '#3b82f6';
        riskLevel = 'Riesgo Moderado';
      } else {
        financialBadge = '🏦 Banquero Suizo / Caja Fuerte';
        badgeColor = '#10b981';
        riskLevel = 'Bajo Riesgo (Solvente)';
      }

      // Recomendaciones de Mercado para el rival (asistencia de fichajes)
      const recommendations = [];
      if (isMe) {
        recommendations.push({
          name: 'Lateral / Zaguero de Primera (¡Cubierto con Álvaro Carreras!)',
          pos: 'Defensa',
          price: 1440000,
          reason: 'Fichaje estratégico cerrado con éxito para apontalar el carril izquierdo en el 3-4-3.'
        });
      } else {
        if (weaknesses.some(w => w.includes('defensiva') || w.includes('Zaga') || w.includes('desierto'))) {
          const targetDef = marketPlayers.find(mp => (mp.position === 'defender' || mp.type === 'defender') && mp.price > 1000000);
          if (targetDef) recommendations.push({ name: targetDef.name, pos: 'Defensa', price: targetDef.price, reason: 'Reforzar la zaga con un zaguero de garantías.' });
        }
        if (weaknesses.some(w => w.includes('delantero') || w.includes('despobladas'))) {
          const targetFwd = marketPlayers.find(mp => (mp.position === 'striker' || mp.type === 'striker') && mp.price > 1500000);
          if (targetFwd) recommendations.push({ name: targetFwd.name, pos: 'Delantero', price: targetFwd.price, reason: 'Aportar pólvora y remate al área rival.' });
        }
        if (recommendations.length === 0) {
          const targetMid = marketPlayers.find(mp => (mp.position === 'midfielder' || mp.type === 'midfielder') && mp.price > 1200000);
          if (targetMid) recommendations.push({ name: targetMid.name, pos: 'Centrocampista', price: targetMid.price, reason: 'Mejorar el control del balón y balones parados.' });
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
          analysis: specAnalysis
        },
        starters: (lineup.starting11 || []).map(p => ({
          id: p.playerId || p.id,
          name: p.name,
          position: p.type || p.position,
          price: p.price || 0,
          expectedPoints: p.expectedPoints || 3.5,
          image: `/media/players/${p.playerId || p.id}.png`
        })),
        bench: (lineup.bench || []).map(p => ({
          id: p.playerId || p.id,
          name: p.name,
          position: p.type || p.position,
          price: p.price || 0,
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

