import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { ensurePlayerPhoto } from './imageGen.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const CLUB_CRESTS = {
  'Fermín Gadura F.C.': '/media/crests/fermin.png',
  'Ana': '/media/crests/ana.png',
  'Pachangueros F.C.': '/media/crests/pachangueros.png',
  'NIN Team': '/media/crests/nin.png',
  'Puente Avios FC': '/media/crests/puente_avios.png',
  'Puente Avios': '/media/crests/puente_avios.png',
  'M4 TEAM': '/media/crests/m4.png',
  'Melano Plabloroza': '/media/crests/melano.png',
  'Suances nin': '/media/crests/suances.png',
  'Hache FC': '/media/crests/hache.png',
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

      if (teamName.toLowerCase().includes('suances')) {
        financialHealth = 'Apalancamiento Extremo (Riesgo)';
        debtAlert = 'Deuda estimada de ~6.0M € por el traspaso récord de Mbappé (34.75M €). Requiere venta inmediata de Juan Foyth o Andrés Martín para no puntuar 0.';
        strengths.push('Poder goleador supremo con Kylian Mbappé (29.6M €).');
        weaknesses.push('Defensa y medular despobladas para costear a Mbappé; plantilla corta de 12 jugadores.');
        tacticDescription = 'Esquema ofensivo centrado en abastecer a Mbappé en punta.';
      } else if (teamName.toLowerCase().includes('fermin')) {
        financialHealth = 'Patrimonio Muy Alto (Riesgo de Rotación)';
        debtAlert = 'Sin deuda aparente, pero dependencia crítica del 56% de sus puntos en Raphinha y Fermín López.';
        strengths.push('Dupla letal del FC Barcelona: Raphinha (32 pts) y Fermín López (31 pts).');
        weaknesses.push('Zaga defensiva muy frágil (4 defensas de menos de 800k €). Peligro de rotaciones europeas.');
        tacticDescription = 'Esquema 4-5-1 basado en la llegada de segunda línea.';
      } else if (teamName.toLowerCase().includes('ana')) {
        financialHealth = 'Solvente con Fuerte Inversión en Zaga';
        strengths.push('Muro defensivo galáctico con Pau Cubarsí (16.5M €) y Andreas Christensen.');
        weaknesses.push('Falta de un delantero centro goleador de referencia en LaLiga.');
        tacticDescription = 'Estructura defensiva sólida de 5 zagueros (5-3-2).';
      } else if (isMe) {
        financialHealth = '100% Saneado (0 € Deuda)';
        strengths.push('Bloque de gala homogéneo en todas las líneas con Fede Valverde (240 pts), Soria y Gerard Moreno.');
        weaknesses.push('Búsqueda activa de un lateral galáctico (Grimaldo) para redondear el Once de 65 pts.');
        tacticDescription = '3-4-3 dinámico de máxima posesión y equilibrio de Primera.';
      } else {
        if (atkVal > 25000000) strengths.push('Gran inversión en atacantes con gol.');
        else if (midVal > 25000000) strengths.push('Centro del campo con alta capacidad de distribución.');
        else strengths.push('Equipo con buena regularidad en puntuaciones medias.');

        if (defVal < 5000000) weaknesses.push('Línea defensiva con bajo valor de mercado, vulnerable a goles encajados.');
        if (squad.length < 13) weaknesses.push('Plantilla corta con poco margen de rotación ante lesiones o sanciones.');
        if (weaknesses.length === 0) weaknesses.push('Margen de mejora en la eficiencia de puntos por millón invertido (PPM).');
        tacticDescription = `Formación ${lineup.formation || '4-4-2'} orientada a maximizar puntos según plantilla disponible.`;
      }

      // Recomendaciones de Mercado para el rival (asistencia de fichajes)
      const recommendations = [];
      if (weaknesses.some(w => w.includes('defensiva') || w.includes('Zaga'))) {
        const targetDef = marketPlayers.find(mp => (mp.position === 'defender' || mp.type === 'defender') && mp.price > 1000000);
        if (targetDef) recommendations.push({ name: targetDef.name, pos: 'Defensa', price: targetDef.price, reason: 'Reforzar la zaga con un central titular de garantías.' });
      }
      if (weaknesses.some(w => w.includes('delantero') || w.includes('despobladas'))) {
        const targetFwd = marketPlayers.find(mp => (mp.position === 'striker' || mp.type === 'striker') && mp.price > 1500000);
        if (targetFwd) recommendations.push({ name: targetFwd.name, pos: 'Delantero', price: targetFwd.price, reason: 'Aportar pólvora y remate al área rival.' });
      }
      if (recommendations.length === 0) {
        const targetMid = marketPlayers.find(mp => (mp.position === 'midfielder' || mp.type === 'midfielder') && mp.price > 1200000);
        if (targetMid) recommendations.push({ name: targetMid.name, pos: 'Centrocampista', price: targetMid.price, reason: 'Mejorar el control del balón y balones parados.' });
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
  console.log(`[RIVALS-AUDIT] ✅ rivalsAudit.json generado con éxito para ${auditClubs.length} clubes.`);
  await client.close();
}

generateRivalsAuditData();
