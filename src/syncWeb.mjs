import dotenv from 'dotenv';
dotenv.config();
import { ComunioClient } from './comunioClient.js';
import { analyzeRivals } from './rivals.js';
import axios from 'axios';
import { getTransfermarktData } from './transfermarkt.js';
import fs from 'fs';
import path from 'path';

async function fetchRealData() {
  const client = new ComunioClient();
  await client.login();
  
  // Squad
  const squad = await client.getSquad();
  const currentLineup = await client.getCurrentLineup() || [];
  const lineupArr = Array.isArray(currentLineup) ? currentLineup : (currentLineup.players || []);
  const startingIds = new Set(lineupArr.map(p => p.playerId || p.id));
  
  const squadJson = {
    coach: "Mateo Oslomany",
    players: []
  };

  for (const p of squad.players) {
    const photoUrl = `https://api.comunio.es/players/${p.playerId}/photo?size=l&cropped=1`;
    const localPhotoPath = `/media/players/${p.playerId}.png`;
    
    try {
      const res = await axios.get(photoUrl, { headers: client.getHeaders(), responseType: 'arraybuffer' });
      fs.writeFileSync(`./web/public/media/players/${p.playerId}.png`, res.data);
    } catch (e) {
      console.warn(`No se pudo descargar la foto de ${p.name}`);
    }

    squadJson.players.push({
      id: p.playerId,
      name: p.name,
      position: p.type,
      number: Math.floor(Math.random() * 99) + 1,
      image: localPhotoPath,
      isStarter: startingIds.has(p.playerId),
      stats: { matches: p.stats?.matchDays || 0, goals: p.stats?.goals || 0, points: p.stats?.points || 0 }
    });
  }

  
  // TM Data for Squad
  for (const p of squadJson.players) {
    const tm = await getTransfermarktData(p.name);
    p.tmValue = tm ? tm.value : 0;
  }
  fs.writeFileSync('./web/src/data/squad.json', JSON.stringify(squadJson, null, 2));
    
  
  // Dashboard / Standings & Rivals
  const dashboard = await client.getDashboardData();
  const realStandings = await client.getStandings();
  const rivalsData = await analyzeRivals(client);
  
  
  // Market
  const rawMarket = await client.getMarket();
  const marketJson = rawMarket.players.map(p => ({
    id: p.playerId,
    name: p.name,
    price: p.price,
    position: p.type,
    points: p.totalPoints,
    owner: p.owner.name,
    ownerId: p.owner.id,
    image: `https://api.comunio.es/players/${p.playerId}/photo?size=l&cropped=1`
  }));
  
  for(const p of marketJson) {
    const photoUrl = p.image;
    p.image = `/media/players/${p.id}.png`;
    if(!fs.existsSync(`./web/public/media/players/${p.id}.png`)) {
      try {
        const res = await axios.get(photoUrl, { headers: client.getHeaders(), responseType: 'arraybuffer' });
        fs.writeFileSync(`./web/public/media/players/${p.id}.png`, res.data);
      } catch(e) {}
    }
  }
  
  
  // TM Data for Market
  for (const p of marketJson) {
    const tm = await getTransfermarktData(p.name);
    p.tmValue = tm ? tm.value : 0;
  }
  fs.writeFileSync('./web/src/data/market.json', JSON.stringify(marketJson, null, 2));
    

  // Matches & Standings Enriched
  const matchdays = await client.getMatchdays();
  const nextMd = matchdays.find(md => !md.finished && !md.started) || matchdays.find(md => !md.finished);
  let opponent = "Resto de la Liga";
  if (realStandings && realStandings.length > 1) {
    const rivals = realStandings.filter(t => t.id !== 21163822);
    if (rivals.length > 0) {
      opponent = rivals[Math.floor(Math.random() * rivals.length)].name;
    }
  }
  
  const standingsDataEnriched = realStandings.map((t, index) => {
    const rivalObj = rivalsData.find(r => r.userId === t.id || r.teamName.toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(r.teamName.toLowerCase()));
    const squadVal = rivalObj ? rivalObj.squadValue : (t.teamValue || 0);
    const stars = rivalObj ? rivalObj.stars : [];

    return {
      pos: index + 1,
      team: t.name,
      pts: t.points,
      value: squadVal,
      stars: stars
    };
  });

  const myStanding = standingsDataEnriched.find(t => t.team.toLowerCase().includes('racing de oslo') || t.team.toLowerCase().includes('oslo'));
  const realPos = myStanding ? myStanding.pos : (dashboard?.position || 1);
  const realPts = myStanding ? myStanding.pts : (dashboard?.points || 0);

  const matchesJson = {
    nextMatch: {
      competition: "Comunio Liga Total",
      matchday: nextMd ? nextMd.matchdayKey : 1,
      opponent: opponent,
      date: nextMd ? "Próxima Jornada" : "Por determinar",
      venue: "Oslo Arena"
    },
    standingsInfo: {
      position: realPos,
      points: realPts,
      form: ["-", "-", "-", "-", "-"]
    },
    standingsData: standingsDataEnriched
  };
  fs.writeFileSync('./web/src/data/matches.json', JSON.stringify(matchesJson, null, 2));
  
  // Verificación y aseguramiento de que todas las imágenes de noticias existan en disco
  try {
    const { generateTemplateGraphic } = await import('./imageGen.js');
    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
      for (const item of newsList) {
        if (item.image && item.image.startsWith('/media/news_graphics/')) {
          const localImgPath = path.resolve('web/public', item.image.replace(/^\//, ''));
          if (!fs.existsSync(localImgPath)) {
            const matchType = item.image.match(/\/media\/news_graphics\/([a-z]+)_(\d+)\.jpg/);
            if (matchType) {
              const type = matchType[1];
              const playerId = matchType[2];
              const playerName = item.title.replace(/¡Oficial!|ficha por el Racing de Oslo|Parte Médico & Estado:/gi, '').trim();
              await generateTemplateGraphic(type, playerName, '', playerId);
            }
          }
        }
      }
    }
  } catch (gfxErr) {
    console.warn('[SYNC-WEB] Info verificación gráficas:', gfxErr.message);
  }

  // Auto-commit y push a GitHub para desencadenar el despliegue automático en Cloudflare Pages / Workers
  try {
    const { execSync } = await import('child_process');
    console.log("[SYNC-WEB] Subiendo cambios a GitHub para despliegue en Cloudflare...");
    execSync('git add web/src/data/*.json web/public/media/ web/public/media/news_graphics/', { stdio: 'inherit' });
    execSync('git commit -m "chore(web): Sincronizacion automatica de datos y medios"', { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });
    console.log("[SYNC-WEB] 🚀 ¡Despliegue enviado a Cloudflare con éxito!");
  } catch (err) {
    console.warn("[SYNC-WEB] Info auto-push git:", err.message);
  }
}

fetchRealData().catch(console.error);
