import dotenv from 'dotenv';
dotenv.config();
import { ComunioClient } from './comunioClient.js';
import axios from 'axios';
import { getTransfermarktData } from './transfermarkt.js';
import fs from 'fs';

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
    
  
  // Dashboard / Standings
  const dashboard = await client.getDashboardData();
  const realStandings = await client.getStandings();
  
  
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
    

  // Matches
  const matchdays = await client.getMatchdays();
  const nextMd = matchdays.find(md => !md.finished && !md.started) || matchdays.find(md => !md.finished);
  let opponent = "Resto de la Liga";
  if (realStandings && realStandings.length > 1) {
    const rivals = realStandings.filter(t => t.id !== 21163822);
    if (rivals.length > 0) {
      opponent = rivals[Math.floor(Math.random() * rivals.length)].name;
    }
  }
  
  const matchesJson = {
    nextMatch: {
      competition: "Comunio Liga Total",
      matchday: nextMd ? nextMd.matchdayKey : 1,
      opponent: opponent,
      date: nextMd ? "Próxima Jornada" : "Por determinar",
      venue: "Oslo Arena"
    },
    standingsInfo: {
      position: dashboard?.position || 1,
      points: dashboard?.points || 0,
      form: ["-", "-", "-", "-", "-"]
    },
    standingsData: realStandings.map((t, index) => ({
      pos: index + 1,
      team: t.name,
      pts: t.points,
      value: t.teamValue
    }))
  };
  fs.writeFileSync('./web/src/data/matches.json', JSON.stringify(matchesJson, null, 2));
  
  console.log("Web actualizada con éxito!");
  await client.close();
}

fetchRealData().catch(console.error);
