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
    .filter(r => r.category === 'SALTO_CUALITATIVO' || r.category === 'MEJORA_MODERADA') // SUPRIMIR EL_RESTO
    .sort((a, b) => b.upgradePoints - a.upgradePoints); // Ordenar por impacto decreciente

  const pendingBids = await client.getPendingBids();
  const pendingIds = new Set(pendingBids.map(b => parseInt(b.playerId || b.id || 0)).filter(id => id > 0));
  const pendingNames = new Set(pendingBids.map(b => (b.playerName || b.name || '').toLowerCase().trim()).filter(n => n.length > 0));

  let bidMargin = 0;
  try {
    if (fs.existsSync('config.json')) {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      bidMargin = typeof config.bidMargin === 'number' ? config.bidMargin : 0;
    }
  } catch (e) {}

  for (const rec of recommendations) {
    const pid = parseInt(rec.playerId || rec.id || 0);
    const pName = (rec.name || rec.playerName || '').toLowerCase().trim();

    // ⛔ SUPRESIÓN DE DUPLICADOS: Omitir inmediatamente si ya tenemos una puja activa por este jugador
    if ((pid > 0 && pendingIds.has(pid)) || (pName && pendingNames.has(pName)) || (pid > 0 && ignoredIds.has(pid))) {
      console.log(`[MARKET MONITOR] Omitiendo ${rec.name}: Ya existe una puja activa registrada o ignorada.`);
      continue;
    }

    // Fórmula de Sobreprecio Dinámico Inteligente (Inteligencia Competitiva de Mercado):
    // Salto Cualitativo (+35 pts): 12.0% (Para blindar el fichaje frente a sobrepujas agresivas de rivales como Hache FC o Puente Avios)
    // Mejora Moderada en Forma (+20 pts): 4.0%
    // Liquidez Ajustada (< 3M €): 1.0%
    let dynamicMargin = bidMargin || 2.0;
    if (balance < 3000000) {
      dynamicMargin = 1.0;
    } else if (rec.category === 'SALTO_CUALITATIVO' || rec.upgradePoints >= 35) {
      dynamicMargin = 12.0; // Sobrepuja competitiva de blindaje frente a rivales humanos
    } else if (rec.category === 'MEJORA_MODERADA') {
      dynamicMargin = 4.0; // Margen competitivo moderado
    }

    const bidAmount = Math.ceil(rec.price * (1 + dynamicMargin / 100));

    // Definición de COMPRA CRÍTICA (Exige confirmación interactiva por Telegram):
    // Únicamente es crítica si:
    // 1. Es una súper-puja por un jugador estrella cuyo precio supera el límite autoBidLimit (8M €)
    // 2. O consume más del 40% del saldo disponible en caja
    // Las ofertas de oportunidad o parches (< 8M €) se ejecutan 100% AUTOMÁTICAMENTE para no saturar Telegram
    const isCriticalPurchase = rec.price >= autoBidLimit || rec.price >= (balance * 0.40);

    if (isCriticalPurchase) {
      result.manualAlerts.push({ ...rec, playerId: pid, bidAmount, dynamicMargin, isCritical: true });
    } else {
      result.autoBids.push({ ...rec, playerId: pid, bidAmount, dynamicMargin, isCritical: false });
    }
  }

  return result;
}
