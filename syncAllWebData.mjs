import { ComunioClient } from './src/comunioClient.js';
import { ComunioEngine } from './src/engine.js';
import { ensurePlayerPhoto } from './src/imageGen.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

async function syncAllWebSections() {
  console.log('\n=================================================================');
  console.log('🔄 SINCRONIZACIÓN MAESTRA DE TODAS LAS SECCIONES DE LA WEB');
  console.log('=================================================================\n');

  const client = new ComunioClient();
  const engine = new ComunioEngine();

  await client.login();

  // ── 1. SINCRONIZAR PLANTILLA & ONCE TITULAR (web/src/data/squad.json) ──────
  console.log('📌 1. Sincronizando Plantilla y Once Titular...');
  const squad = await client.getSquad();
  const rawSquadPlayers = squad?.players || [];

  // Obtener la alineación actual fijada en Comunio
  let startingIds = [];
  try {
    const url = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/lineup`;
    const res = await axios.get(url, { headers: client.getHeaders() });
    if (res.data && res.data.lineup) {
      startingIds = Object.values(res.data.lineup).map(id => parseInt(id)).filter(Boolean);
    }
  } catch (e) {
    console.warn('  [SYNC] No se pudo leer alineación previa vía API, calculando XI óptimo...');
    const lineupResult = engine.optimizeLineup(squad);
    startingIds = lineupResult.starting11.map(p => p.playerId || p.id);
  }

  const updatedSquadPlayers = [];
  for (const p of rawSquadPlayers) {
    const pid = p.id || p.playerId;
    const photoUrl = await ensurePlayerPhoto(pid);
    const isStarter = startingIds.includes(parseInt(pid));
    const expectedPts = engine.getExpectedPoints(p);

    updatedSquadPlayers.push({
      id: pid,
      name: p.name,
      position: p.type || p.position || 'midfielder',
      number: p.number || Math.floor(Math.random() * 90) + 1,
      image: photoUrl,
      isStarter: isStarter,
      expectedPoints: expectedPts,
      status: p.status || 'Disponible',
      statusInfo: p.statusInfo || '',
      price: p.price || 0,
      stats: {
        matches: p.totalMatches || 0,
        goals: p.goals || 0,
        points: p.totalPoints || 0
      },
      tmValue: p.price ? `${(p.price / 1000000).toFixed(2)} mill. €` : 'N/D'
    });
  }

  const squadOutput = {
    coach: "Mateo Oslomany",
    players: updatedSquadPlayers
  };

  fs.writeFileSync('web/src/data/squad.json', JSON.stringify(squadOutput, null, 2));
  console.log(`   └─ Plantilla sincronizada (${updatedSquadPlayers.length} jugadores, ${startingIds.length} titulares).`);


  // ── 2. SINCRONIZAR CLASIFICACIÓN Y PRÓXIMA JORNADA (web/src/data/matches.json) ──
  console.log('\n📌 2. Sincronizando Clasificación de la Liga y Próxima Jornada...');
  let standingsData = [];
  let userPos = 1;
  let userPoints = 0;

  try {
    const standingsUrl = `https://api.comunio.es/communities/${client.communityId}/standings`;
    const res = await axios.get(standingsUrl, { headers: client.getHeaders() });
    const items = res.data?.items || res.data || [];

    standingsData = items.map((item, idx) => {
      const isUser = item.user?.id === client.userId || item.userId === client.userId;
      if (isUser) {
        userPos = item.position || (idx + 1);
        userPoints = item.points || 0;
      }
      return {
        pos: item.position || (idx + 1),
        team: item.user?.name || item.userName || `Usuario #${item.userId || idx + 1}`,
        pts: item.points || 0,
        value: item.teamValue || item.value || 0
      };
    });
  } catch (e) {
    console.warn('  [SYNC] Error cargando tabla de clasificación:', e.message);
  }

  const matchesOutput = {
    nextMatch: {
      competition: "Comunio Liga Total",
      matchday: "2",
      opponent: "Rival de Liga",
      date: "Próxima Jornada",
      venue: "Oslo Arena"
    },
    standingsInfo: {
      position: userPos,
      points: userPoints,
      form: ["-", "-", "-", "-", "-"]
    },
    standingsData: standingsData.length > 0 ? standingsData : [
      { pos: 1, team: "Racing de Oslo", pts: userPoints, value: 35000000 }
    ]
  };

  fs.writeFileSync('web/src/data/matches.json', JSON.stringify(matchesOutput, null, 2));
  console.log('   └─ Clasificación y próxima jornada actualizadas.');


  // ── 3. SINCRONIZAR MERCADO DE FICHAJES (web/src/data/market.json) ──────────
  console.log('\n📌 3. Sincronizando Mercado de Fichajes en Vivo...');
  const market = await client.getMarket();
  const rawMarketPlayers = market?.players || market || [];

  const updatedMarket = [];
  for (const p of rawMarketPlayers) {
    const pid = p.id || p.playerId;
    const photoUrl = await ensurePlayerPhoto(pid);

    updatedMarket.push({
      id: pid,
      name: p.name,
      price: p.price,
      position: p.type || p.position || 'jugador',
      points: p.totalPoints || 0,
      owner: p.owner?.name || 'Computer',
      ownerId: p.owner?.id || 1,
      image: photoUrl,
      tmValue: p.price ? `${(p.price / 1000000).toFixed(2)} mill. €` : 'N/D'
    });
  }

  fs.writeFileSync('web/src/data/market.json', JSON.stringify(updatedMarket, null, 2));
  console.log(`   └─ Mercado actualizado (${updatedMarket.length} fichajes disponibles).`);


  // ── 4. COMPILAR PROYECTO WEB Y SUBIR A GITHUB ──────────────────────────────
  console.log('\n📌 4. Compilando Web Frontend y Desplegando en GitHub...');
  try {
    execSync('cd web && npm run build', { stdio: 'inherit' });
    execSync('git add -A && git commit -m "chore: Sincronización maestra de todas las secciones de la web (plantilla, clasificación, mercado y noticias)" && git push origin main', { stdio: 'inherit' });
    console.log('\n✅ ¡Todas las secciones de la web han sido sincronizadas y desplegadas en GitHub & Cloudflare Pages!');
  } catch (e) {
    console.error('Error al compilar o publicar en GitHub:', e.message);
  }

  await client.close();
}

syncAllWebSections();
