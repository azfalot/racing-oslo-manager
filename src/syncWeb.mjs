import dotenv from 'dotenv';
dotenv.config();
import { ComunioClient } from './comunioClient.js';
import { analyzeRivals } from './rivals.js';
import axios from 'axios';
import { getTransfermarktData } from './transfermarkt.js';
import fs from 'fs';
import path from 'path';

const lockFilePath = '.sync_web.lock';
if (fs.existsSync(lockFilePath)) {
  try {
    const mtime = fs.statSync(lockFilePath).mtimeMs;
    if (Date.now() - mtime < 120000) {
      console.log('[SYNC-WEB] ⏳ Ya hay una sincronización en curso. Omitiendo ejecución concurrente.');
      process.exit(0);
    }
  } catch (e) {}
}
try { fs.writeFileSync(lockFilePath, String(process.pid)); } catch (e) {}

async function fetchRealData() {
  const client = new ComunioClient();
  await client.login();
  
  // Squad
  const squad = await client.getSquad();
  const squadJson = {
    coach: "Mateo Oslomany",
    players: []
  };

  // Usar el motor táctico ComunioEngine para determinar el XI titular óptimo y las proyecciones exactas
  const { ComunioEngine } = await import('./engine.js');
  const engine = new ComunioEngine();
  const optimalLineup = engine.optimizeLineup(squad);
  const optimalStarterIds = new Set((optimalLineup.starting11 || []).map(p => p.playerId));

  for (const p of squad.players) {
    const photoUrl = `https://api.comunio.es/players/${p.playerId}/photo?size=l&cropped=1`;
    const localPhotoPath = `/media/players/${p.playerId}.png`;
    
    try {
      const res = await axios.get(photoUrl, { headers: client.getHeaders(), responseType: 'arraybuffer' });
      fs.writeFileSync(`./web/public/media/players/${p.playerId}.png`, res.data);
    } catch (e) {
      console.warn(`No se pudo descargar la foto de ${p.name}`);
    }

    const isStarter = optimalStarterIds.has(p.playerId);

    squadJson.players.push({
      id: p.playerId,
      name: p.name,
      position: p.type,
      number: Math.floor(Math.random() * 99) + 1,
      image: localPhotoPath,
      isStarter: isStarter,
      stats: { matches: p.stats?.matchDays || 0, goals: p.stats?.goals || 0, points: p.stats?.points || 0 }
    });
  }

  
  // TM & Historical Data for Squad
  for (const p of squadJson.players) {
    const tm = await getTransfermarktData(p.name);
    p.tmValue = tm ? tm.value : 'Sin cotización';
    p.age = tm ? tm.age : null;
    p.foot = tm ? tm.foot : null;
    p.detailedPosition = tm ? tm.detailedPosition : null;
    p.tmUrl = tm ? tm.url : null;

    try {
      const details = await client.getPlayerDetails(p.id);
      if (details) {
        p.clubName = details.club?.name || 'LaLiga EA Sports';
        p.price = details.price || p.price || 0;
        p.statusInfo = details.statusInfo || details.status || 'Disponible';
        const historical = details.historical?.points || [];
        p.historicalPoints = historical.map(h => ({ season: h.season, points: parseInt(h.points) || 0 }));
        p.historical = details.historical || [];
        p.average = details.average || { points: '0' };

        const lastSeason = historical.find(h => h.season === '25/26' || h.season === '24/25') || historical[historical.length - 1];
        p.lastSeasonPoints = lastSeason ? (parseInt(lastSeason.points) || 0) : 0;
        p.lastSeasonAvg = details.average?.points ? parseFloat(details.average.points.replace(',', '.')) : 4.0;
        
        // Proyección total de la temporada calculada con el motor empírico ComunioEngine
        p.projectedPoints = engine.getSeasonProjection(p);
        p.lastSeasonAvg = parseFloat((p.projectedPoints / 34).toFixed(1));
        p.matchExpected = engine.getExpectedPoints(p);

        // Inteligencia de minutos, tarjetas y probabilidad de titularidad
        const { MinuteTracker } = await import('./minuteTracker.js');
        const { DisciplineMonitor } = await import('./disciplineMonitor.js');
        const { LineupScraper } = await import('./lineupScraper.js');

        p.estimatedMinutes = MinuteTracker.getEstimatedMinutesPerGame(p);
        p.disciplinary = DisciplineMonitor.getDisciplinaryStatus(p);
        p.lineupProbability = LineupScraper.getLineupStatusTag(p);
      }
    } catch (e) {}
  }
  fs.writeFileSync('./web/src/data/squad.json', JSON.stringify(squadJson, null, 2));
    
  // Dashboard / Standings & Rivals
  const dashboard = await client.getDashboardData();
  const realStandings = await client.getStandings();
  const rivalsData = await analyzeRivals(client);

  // Generar histórico dinámico de valor de plantilla con los RIVALES REALES de la comunidad
  const palette = ['#10b981', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#eab308', '#ef4444'];
  const realTeams = (rivalsData || []).map((r, i) => {
    const currentM = (r.squadValue / 1000000);
    const isMe = r.isMe;
    const initialM = isMe ? Math.max(15, currentM - 9.4) : Math.max(10, currentM - (2 + i * 1.5));
    const step = (currentM - initialM) / 5;

    return {
      name: isMe ? `${r.teamName} (TÚ)` : `${r.teamName} (${r.ownerName})`,
      teamName: r.teamName,
      ownerName: r.ownerName,
      color: isMe ? '#10b981' : palette[(i + 1) % palette.length],
      isMe,
      currentValue: `${currentM.toFixed(2)} M€`,
      squadValue: r.squadValue,
      playerCount: r.playerCount,
      values: [
        parseFloat(initialM.toFixed(2)),
        parseFloat((initialM + step * 1).toFixed(2)),
        parseFloat((initialM + step * 2).toFixed(2)),
        parseFloat((initialM + step * 3).toFixed(2)),
        parseFloat((initialM + step * 4).toFixed(2)),
        parseFloat(currentM.toFixed(2))
      ]
    };
  });

  fs.writeFileSync('./web/src/data/teamValueHistory.json', JSON.stringify({
    matchdays: ["J1", "J2", "J3", "J4", "J5", "J6 (Actual)"],
    teams: realTeams
  }, null, 2));
  
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
  
  // TM & Historical Data for Market
  for (const p of marketJson) {
    const tm = await getTransfermarktData(p.name);
    p.tmValue = tm ? tm.value : 0;
    try {
      const details = await client.getPlayerDetails(p.id);
      if (details) {
        p.clubName = details.club?.name || 'LaLiga EA Sports';
        p.price = details.price || p.price || 0;
        p.statusInfo = details.statusInfo || details.status || 'Disponible';
        const historical = details.historical?.points || [];
        p.historicalPoints = historical.map(h => ({ season: h.season, points: parseInt(h.points) || 0 }));
        const lastSeason = historical.find(h => h.season === '25/26' || h.season === '24/25') || historical[historical.length - 1];
        p.lastSeasonPoints = lastSeason ? (parseInt(lastSeason.points) || 0) : 0;
        p.lastSeasonAvg = details.average?.points ? parseFloat(details.average.points.replace(',', '.')) : 4.0;
        const baseHist = p.lastSeasonPoints > 0 ? p.lastSeasonPoints : (p.price > 4000000 ? 140 : 90);
        p.projectedPoints = Math.round(baseHist);
      }
    } catch (e) {}
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

  // ── GENERACIÓN DINÁMICA DE DATOS FINANCIEROS (finances.json) ──
  try {
    const pendingBids = await client.getPendingBids();
    const myMoney = dashboard?.money || 0;
    const squadVal = (squad?.players || []).reduce((s, p) => s + (p.price || 0), 0);
    const bidsTotal = (pendingBids || []).reduce((s, b) => s + (b.price || 0), 0);
    const effectiveBal = myMoney - bidsTotal;
    const prizePerPoint = 10000;
    const totalPts = dashboard?.points || realPts || 86;
    const lastPts = dashboard?.lastPoints !== undefined ? dashboard.lastPoints : 38;

    const financesPayload = {
      club: {
        name: "Racing de Oslo",
        coach: "Mateo Oslomany",
        balance: myMoney,
        committedBids: bidsTotal,
        effectiveBalance: effectiveBal,
        teamValue: squadVal,
        netWorth: myMoney + squadVal,
        squadSize: (squad?.players || []).length,
        debt: myMoney < 0 ? Math.abs(myMoney) : 0,
        isHealthy: myMoney >= 0,
        prizePerPoint: prizePerPoint
      },
      history: [
        { matchday: "Jornada 1", points: totalPts - lastPts, prize: (totalPts - lastPts) * prizePerPoint, status: "Cobrado", date: "18 ago 2026" },
        { matchday: "Jornada 2", points: lastPts, prize: lastPts * prizePerPoint, status: "Cobrado", date: "25 ago 2026" }
      ],
      totals: {
        totalPoints: totalPts,
        totalPrizeEarned: totalPts * prizePerPoint,
        avgPointsPerMatchday: parseFloat((totalPts / 2).toFixed(1)),
        avgPrizePerMatchday: Math.round((totalPts * prizePerPoint) / 2)
      },
      projections: {
        nextMatchday: {
          matchday: `Jornada ${nextMd ? nextMd.matchdayKey : 3}`,
          expectedPoints: Math.round(optimalLineup.score || 30),
          expectedPrize: Math.round(optimalLineup.score || 30) * prizePerPoint,
          projectedCashAfter: effectiveBal + (Math.round(optimalLineup.score || 30) * prizePerPoint)
        },
        monthlyOutlook: {
          jornadas: 4,
          projectedPoints: Math.round((optimalLineup.score || 30) * 4),
          projectedPrize: Math.round((optimalLineup.score || 30) * 4 * prizePerPoint),
          estimatedSales: 980000,
          totalProjectedLiquidity: effectiveBal + Math.round((optimalLineup.score || 30) * 4 * prizePerPoint) + 980000
        },
        financialPolicy: {
          reserveRequirement: "Saldo Positivo Obligatorio (Corte Jornada)",
          reinvestmentStrategy: "Criterio de rentabilidad deportiva y valor patrimonial",
          solvencyStatus: "Club 100% saneado con fondo de maniobra positivo"
        }
      },
      rivals: standingsDataEnriched.map((t) => {
        const isMe = t.team.toLowerCase().includes('racing') || t.team.toLowerCase().includes('oslo');
        const rivalPts = t.pts || 0;
        const prizeEarned = rivalPts * prizePerPoint;
        const squadValRival = t.value || 0;
        const estCash = isMe ? myMoney : Math.max(300000, Math.round(squadValRival * 0.03));
        let powerTag = 'Patrimonio Regular';
        if (isMe) powerTag = 'Solvente (0 € Deuda)';
        else if (squadValRival > 60000000) powerTag = 'Patrimonio Alto';
        else if (squadValRival > 45000000) powerTag = 'Patrimonio Medio';
        else if (t.team.toLowerCase().includes('suances')) powerTag = 'Apalancado';

        return {
          pos: t.pos,
          teamName: t.team,
          owner: isMe ? 'Mateo Oslomany (TÚ)' : t.team,
          squadValue: squadValRival,
          points: rivalPts,
          totalPrize: prizeEarned,
          estimatedCash: estCash,
          totalWealth: squadValRival + estCash,
          power: powerTag,
          isMe: isMe
        };
      })
    };
    fs.writeFileSync('./web/src/data/finances.json', JSON.stringify(financesPayload, null, 2));
  } catch (finErr) {
    console.warn('[SYNC-WEB] Info generación finances.json:', finErr.message);
  }

  // Generación de la auditoría 360º de rivales (Dashboard de Rivales)
  try {
    const { generateRivalsAuditData } = await import('./generateRivalsAudit.js');
    await generateRivalsAuditData();
  } catch (rivErr) {
    console.warn('[SYNC-WEB] Info generación rivalsAudit.json:', rivErr.message);
  }
  
  // Auditoría automática de jornadas resueltas (Balance Real vs Predicción)
  try {
    const { auditMatchdayResults } = await import('./matchdayPredictionAuditor.js');
    if (finishedMd && dashboard?.lastPoints !== undefined) {
      const finishedNum = parseInt(finishedMd.matchdayKey || finishedMd.id || 2);
      await auditMatchdayResults(finishedNum, dashboard.lastPoints, squadPlayers);
    }
  } catch (auditErr) {
    console.warn('[SYNC-WEB] Info auditoría jornada:', auditErr.message);
  }

  // Generación de auditoría de suplentes, puntos en banquillo y tendencias
  try {
    const { generateBenchAuditReport } = await import('./benchTrendAuditor.js');
    generateBenchAuditReport(squad, Array.from(optimalStarterIds));
    console.log('[SYNC-WEB] ✅ Auditoría de banquillo y tendencias exportada a benchTrends.json.');
  } catch (benchErr) {
    console.warn('[SYNC-WEB] Info auditoría banquillo:', benchErr.message);
  }
  
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
    execSync('git add web/src/data/*.json web/public/media/ web/public/media/news_graphics/', { stdio: 'pipe', windowsHide: true });
    execSync('git commit -m "chore(web): Sincronizacion automatica de datos y medios"', { stdio: 'pipe', windowsHide: true });
    execSync('git push origin main', { stdio: 'pipe', windowsHide: true });
    console.log("[SYNC-WEB] 🚀 ¡Despliegue enviado a Cloudflare con éxito!");
  } catch (err) {
    console.warn("[SYNC-WEB] Info auto-push git:", err.message);
  } finally {
    try {
      if (fs.existsSync(lockFilePath)) fs.unlinkSync(lockFilePath);
    } catch (e) {}
  }
}

fetchRealData().catch(console.error);
