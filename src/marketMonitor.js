import fs from 'fs';
import axios from 'axios';
import { ComunioEngine } from './engine.js';
import { getRivalBiddingIntelligence } from './rivals.js';

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
export function getAutoBidLimit() {
  try {
    if (fs.existsSync('config.json')) {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      const val = config.strategy?.liquidity?.autoBidLimit ?? config.autoBidLimit;
      if (typeof val === 'number') {
        return val < 1000 ? val * 1000000 : val;
      }
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

  // Obtener inteligencia de pujas de rivales (si está disponible)
  let rivalIntel = null;
  try {
    rivalIntel = await getRivalBiddingIntelligence(client);
  } catch (e) {
    console.warn('[MARKET MONITOR] No se pudo obtener inteligencia de rivales:', e.message);
  }

  // Analizar mercado con el motor de optimización de plantilla
  const marketAnalysis = engine.analyzeMarket(currentPlayers, squad, balance, rivalIntel);
  const recommendations = (marketAnalysis.recommendations || [])
    .filter(r => r.action !== 'PASS' && r.category !== 'EL_RESTO')
    .sort((a, b) => (b.strategicScore || 0) - (a.strategicScore || 0));

  // 🛡️ REGLA DE ORO DE TESORERÍA PRE-JORNADA:
  // El tope de pujas abiertas concurrentes es estrictamente el SALDO LÍQUIDO DISPONIBLE (balance).
  // De esta forma, aunque la Computadora acepte el 100% de las pujas simultáneamente, NUNCA entraremos en deuda.
  const maxOpenBidsCap = balance;
  const pendingBids = await client.getPendingBids();
  let currentOpenBidsSum = pendingBids.reduce((s, b) => s + (b.price || 0), 0);
  let availableBiddingPower = Math.max(0, maxOpenBidsCap - currentOpenBidsSum);

  const pendingIds = new Set(pendingBids.map(b => parseInt(b.playerId || b.id || 0)).filter(id => id > 0));
  const pendingNames = new Set(pendingBids.map(b => (b.playerName || b.name || '').toLowerCase().trim()).filter(n => n.length > 0));

  for (const rec of recommendations) {
    const pid = parseInt(rec.playerId || rec.id || 0);
    const pName = (rec.name || rec.playerName || '').toLowerCase().trim();

    // ⛔ SUPRESIÓN DE DUPLICADOS Y JUGADORES EN LISTA NEGRA / CANCELADOS
    if ((pid > 0 && pendingIds.has(pid)) || (pName && pendingNames.has(pName)) || (pid > 0 && ignoredIds.has(pid))) {
      console.log(`[MARKET MONITOR] Omitiendo ${rec.name}: Ya existe una puja activa registrada o en lista ignorada.`);
      continue;
    }

    // 🛡️ REGLA 2: COMPRAS EXCLUSIVAS A COMPUTER (Cero Financiación a Rivales)
    if (!rec.isComputer && rec.ownerId && rec.ownerId !== 1 && (rec.ownerName || '').toLowerCase() !== 'computer') {
      console.log(`[MARKET MONITOR] 🚫 Omitiendo ${rec.name}: Jugador propiedad de rival (${rec.ownerName || 'Usuario'}). Bloqueado según Regla 2.`);
      continue;
    }

    // 🛡️ REGLA 3: PRECIO EXACTO (0% SOBREPRECIO)
    const bidAmount = rec.price;
    const dynamicMargin = 0;

    // 🛡️ CONTROL DE CAPACIDAD ESTRICTO: Verificar que la puja cabe en la liquidez disponible
    if (bidAmount > availableBiddingPower) {
      console.log(`[MARKET MONITOR] Omitiendo ${rec.name} (${bidAmount.toLocaleString()} €): Excede el cupo disponible de saldo líquido (${availableBiddingPower.toLocaleString()} € de ${maxOpenBidsCap.toLocaleString()} €).`);
      continue;
    }

    availableBiddingPower -= bidAmount;

    // Clasificación de seguridad: si la acción calculada es REQUIRE_CONFIRMATION o excede límites
    const isCriticalPurchase = rec.action === 'REQUIRE_CONFIRMATION' ||
      rec.price >= autoBidLimit ||
      rec.price >= (balance * 0.40);

    if (isCriticalPurchase) {
      result.manualAlerts.push({
        ...rec,
        playerId: pid,
        bidAmount,
        dynamicMargin,
        isCritical: true
      });
    } else {
      result.autoBids.push({
        ...rec,
        playerId: pid,
        bidAmount,
        dynamicMargin,
        isCritical: false
      });
    }
  }

  return result;
}
