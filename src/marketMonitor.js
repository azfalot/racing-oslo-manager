import fs from 'fs';
import axios from 'axios';
import { ComunioEngine } from './engine.js';

const lastMarketFile = 'last_market.json';
const ignoredPlayersFile = 'ignored_players.json';

function loadLastMarket() {
  try {
    if (fs.existsSync(lastMarketFile)) {
      return JSON.parse(fs.readFileSync(lastMarketFile, 'utf-8'));
    }
  } catch (e) {}
  return { players: [] };
}

function saveLastMarket(players) {
  try {
    fs.writeFileSync(lastMarketFile, JSON.stringify({ players }, null, 2));
  } catch (e) {}
}

function loadIgnoredPlayers() {
  try {
    if (fs.existsSync(ignoredPlayersFile)) {
      const list = JSON.parse(fs.readFileSync(ignoredPlayersFile, 'utf-8'));
      const now = Date.now();
      return list.filter(e => e.expiresAt > now);
    }
  } catch (e) {}
  return [];
}

export function ignorePlayer(playerId, playerName) {
  try {
    const list = loadIgnoredPlayers();
    list.push({
      playerId,
      name: playerName,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    });
    fs.writeFileSync(ignoredPlayersFile, JSON.stringify(list, null, 2));
  } catch (e) {}
}

function getAutoBidLimit() {
  try {
    if (fs.existsSync('config.json')) {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      return typeof config.autoBidLimit === 'number' ? config.autoBidLimit * 1000000 : 8000000;
    }
  } catch (e) {}
  return 8000000;
}

/**
 * Consulta el feed de noticias oficial de Comunio para obtener el registro detallado
 * de traspasos (jugador, precio pagado, comprador y vendedor).
 */
export async function fetchRecentTransactions(client) {
  try {
    const url = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/news`;
    const response = await axios.get(url, { headers: client.getHeaders() });
    const entries = response.data?.newsList?.entries || [];
    const transactions = [];

    for (const entry of entries) {
      if (entry.type === 'TRANSACTION' || entry.title === 'Fichajes') {
        const text = entry.message?.text || '';
        const lines = text.split(/<br\s*\/?>/i);
        for (const line of lines) {
          const clean = line.replace(/<[^>]*>/g, '').trim();
          const match = clean.match(/(.+?)\s+cambia por\s+([\d.,]+\s*€)\s+de\s+(.+?)\s+a\s+(.+)/);
          if (match) {
            transactions.push({
              player: match[1].replace(/^\d{2}:\d{2}\s*-\s*/, '').trim(),
              price: match[2].trim(),
              seller: match[3].trim(),
              buyer: match[4].replace(/\.$/, '').trim(),
              date: entry.date
            });
          }
        }
      }
    }
    return transactions;
  } catch (e) {
    console.error('[MARKET MONITOR] Error leyendo feed de transacciones:', e.message);
    return [];
  }
}

export async function checkMarket(client, squad, balance, botPaused) {
  const engine = new ComunioEngine();
  const lastMarket = loadLastMarket();
  const lastIds = new Set(lastMarket.players.map(p => p.playerId));
  const ignoredPlayers = loadIgnoredPlayers();
  const ignoredIds = new Set(ignoredPlayers.map(e => e.playerId));
  const autoBidLimit = getAutoBidLimit();

  // Obtener mercado actual
  const market = await client.getMarket();
  const currentPlayers = market?.players || [];
  const currentIds = new Set(currentPlayers.map(p => p.playerId));

  // Detectar cambios
  const newPlayers = currentPlayers.filter(p => !lastIds.has(p.playerId));
  const soldPlayers = lastMarket.players.filter(p => !currentIds.has(p.playerId));

  // Guardar estado actual
  saveLastMarket(currentPlayers.map(p => ({ playerId: p.playerId, name: p.name, price: p.price, owner: p.owner?.name || 'Computer' })));

  const result = {
    newPlayers,
    soldPlayers,
    autoBids: [],
    manualAlerts: []
  };

  if (botPaused || currentPlayers.length === 0) return result;

  // Comprobar franja horaria nocturna estratégica (Madrid 23:45h - 23:59h)
  const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const hours = nowMadrid.getHours();
  const minutes = nowMadrid.getMinutes();
  const isNightBiddingWindow = (hours === 23 && minutes >= 45);

  // Analizar jugadores del mercado en venta por la Computadora
  const marketAnalysis = engine.analyzeMarket(currentPlayers, squad, balance);
  const recommendations = (marketAnalysis.recommendations || [])
    .filter(r => r.upgradePoints >= 40) // Solo mejoras sustanciales que vayan directo al 11 titular (+40 pts)
    .sort((a, b) => b.upgradePoints - a.upgradePoints); // Ordenar por impacto decreciente

  const pendingBids = await client.getPendingBids();
  const pendingIds = new Set(pendingBids.map(b => parseInt(b.playerId || b.id)));

  let bidMargin = 0;
  try {
    if (fs.existsSync('config.json')) {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      bidMargin = typeof config.bidMargin === 'number' ? config.bidMargin : 0;
    }
  } catch (e) {}

  let autoBidsPlacedCount = 0;

  for (const rec of recommendations) {
    const pid = parseInt(rec.playerId || rec.id);
    if (pendingIds.has(pid) || ignoredIds.has(pid)) continue;

    const bidAmount = Math.ceil(rec.price * (1 + bidMargin / 100));

    // SI ESTAMOS EN LA FRANJA NOCTURNA (23:45h - 23:59h) Y NO EXCEDEMOS EL MÁXIMO DE 2 PUJAS POR NOCHE
    if (isNightBiddingWindow && autoBidsPlacedCount < 2 && bidAmount <= autoBidLimit && bidAmount <= balance) {
      try {
        console.log(`[NOCTURNO-BID 23:50h] Pujando por ${rec.name} (${bidAmount.toLocaleString()} €) - Mejora: +${rec.upgradePoints.toFixed(0)} pts`);
        const success = await client.placeBid(pid, rec.name, bidAmount);
        if (success) autoBidsPlacedCount++;

        result.autoBids.push({ ...rec, playerId: pid, bidAmount, success });

        let log = [];
        try {
          if (fs.existsSync('audit_log.json')) {
            log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
          }
        } catch (e) {}
        log.push({
          timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          action: 'Puja Nocturna Estratégica (23:50h)',
          player: rec.name,
          amount: `${bidAmount.toLocaleString()} €`,
          status: success ? 'Éxito' : 'Fallo'
        });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

        if (success) {
          try {
            const { publishRumorNews } = await import('./imageGen.js');
            await publishRumorNews(rec.name, `Oferta nocturna de ${bidAmount.toLocaleString()} € enviada (+${rec.upgradePoints.toFixed(0)} pts de mejora)`, pid);
          } catch (imgErr) {}
        }
      } catch (e) {
        console.error(`[AUTO-BID ERROR] Error al pujar por ${rec.name}:`, e.message);
        result.autoBids.push({ ...rec, playerId: pid, bidAmount, success: false });
      }
    } else {
      // Durante el día se registran como alertas analíticas sin emitir pujas para no alertar a los rivales
      result.manualAlerts.push({ ...rec, playerId: pid, bidAmount });
    }
  }

  return result;
}
