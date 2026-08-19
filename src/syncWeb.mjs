import dotenv from 'dotenv';
dotenv.config();
import { ComunioClient } from './comunioClient.js';
import axios from 'axios';
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
    players: squad.players.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      number: Math.floor(Math.random() * 99) + 1, // Comunio doesn't expose shirt numbers easily
      image: `https://api.comunio.es/players/${p.id}/photo?size=l&cropped=1`, // Direct comunio photo URL
      isStarter: startingIds.has(p.id),
      stats: { matches: p.stats?.matchDays || 0, goals: p.stats?.goals || 0, points: p.stats?.points || 0 }
    }))
  };
  fs.writeFileSync('./web/src/data/squad.json', JSON.stringify(squadJson, null, 2));
  
  // Dashboard / Standings
  const dashboard = await client.getDashboardData();
  
  // Matches
  const matchdays = await client.getMatchdays();
  const nextMd = matchdays.find(md => !md.finished && !md.started) || matchdays.find(md => !md.finished);
  let opponent = "Por determinar";
  if (nextMd) {
    const mdId = nextMd._links?.self?.href?.split('/').pop() || nextMd.id;
    const detail = await client.getMatchdayDetail(mdId);
    if (detail && detail.matches) {
       // Just find a match
       const match = detail.matches[0]; // Wait, we need to find the match involving the actual opponent or just the first match? 
       // In Comunio, user doesn't have an "opponent" like in real life. Comunio is a fantasy league against other users.
       // The "opponent" could just be a random real match for flavor, or a rivalry in the community.
       opponent = match.home.name === "Racing" ? match.guest.name : match.home.name;
    }
  }
  
  const matchesJson = {
    nextMatch: {
      competition: "Segunda Regional Cántabra",
      matchday: nextMd ? nextMd.matchdayKey : 1,
      opponent: opponent,
      date: nextMd ? "Próxima Jornada" : "Por determinar",
      venue: "Oslo Arena"
    },
    standings: {
      position: dashboard?.position || 1,
      points: dashboard?.points || 0,
      form: ["-", "-", "-", "-", "-"]
    }
  };
  fs.writeFileSync('./web/src/data/matches.json', JSON.stringify(matchesJson, null, 2));
  
  // News and Rumors
  // ...
  
  await client.close();
}
fetchRealData().catch(console.error);
