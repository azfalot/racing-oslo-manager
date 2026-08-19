import fs from 'fs';
import { ComunioEngine } from './engine.js';

const LAST_MARKET_FILE = 'last_market.json';
const IGNORED_PLAYERS_FILE = 'ignored_players.json';
const AUTO_BID_LIMIT = 10_000_000; // Puja automática si precio <= 10M €. Ajustable con /limite

/**
 * Carga el estado anterior del mercado desde disco.
 */
function loadLastMarket() {
  try {
    if (fs.existsSync(LAST_MARKET_FILE)) {
      return JSON.parse(fs.readFileSync(LAST_MARKET_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { players: [] };
}

/**
 * Guarda el estado actual del mercado en disco.
 */
function saveLastMarket(players) {
  try {
    fs.writeFileSync(LAST_MARKET_FILE, JSON.stringify({ players, timestamp: new Date().toISOString() }, null, 2));
  } catch (e) {}
}

/**
 * Carga la lista de jugadores ignorados temporalmente (24h).
 */
function loadIgnoredPlayers() {
  try {
    if (fs.existsSync(IGNORED_PLAYERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(IGNORED_PLAYERS_FILE, 'utf-8'));
      // Filtrar los que ya han expirado (24h)
      const now = Date.now();
      const valid = data.filter(entry => (now - entry.timestamp) < 24 * 60 * 60 * 1000);
      if (valid.length !== data.length) {
        fs.writeFileSync(IGNORED_PLAYERS_FILE, JSON.stringify(valid, null, 2));
      }
      return valid;
    }
  } catch (e) {}
  return [];
}

/**
 * Añade un jugador a la lista de ignorados por 24h.
 */
export function ignorePlayer(playerId) {
  const ignored = loadIgnoredPlayers();
  if (!ignored.find(e => e.playerId === playerId)) {
    ignored.push({ playerId, timestamp: Date.now() });
    fs.writeFileSync(IGNORED_PLAYERS_FILE, JSON.stringify(ignored, null, 2));
  }
}

/**
 * Carga el límite de puja automática desde config.json.
 */
function getAutoBidLimit() {
  try {
    if (fs.existsSync('config.json')) {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      if (typeof config.autoBidLimit === 'number') return config.autoBidLimit;
    }
  } catch (e) {}
  return AUTO_BID_LIMIT;
}

/**
 * Módulo principal: compara el mercado actual con el anterior y emite eventos.
 * Devuelve un objeto con:
 *   - newPlayers: jugadores recién llegados al mercado
 *   - soldPlayers: jugadores que ya no están (comprados/retirados)
 *   - autoBids: lista de pujas automáticas realizadas
 *   - manualAlerts: lista de jugadores que requieren confirmación manual
 */
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

  // Guardar estado actual para la próxima comprobación
  saveLastMarket(currentPlayers.map(p => ({ playerId: p.playerId, name: p.name, price: p.price })));

  const result = {
    newPlayers,
    soldPlayers,
    autoBids: [],
    manualAlerts: []
  };

  // Si el bot está pausado o no hay jugadores nuevos, no analizar
  if (botPaused || newPlayers.length === 0) return result;

  // Analizar los jugadores nuevos con el motor
  const marketAnalysis = engine.analyzeMarket(newPlayers, squad, balance);
  const recommendations = marketAnalysis.recommendations || [];

  // Cargar pujas pendientes para evitar duplicados
  const pendingBids = await client.getPendingBids();
  const pendingIds = new Set(pendingBids.map(b => b.playerId));

  // Cargar margen desde config
  let bidMargin = 0;
  try {
    if (fs.existsSync('config.json')) {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      bidMargin = typeof config.bidMargin === 'number' ? config.bidMargin : 0;
    }
  } catch (e) {}

  for (const rec of recommendations) {
    // Ignorar si ya tenemos puja activa o está en lista de ignorados
    if (pendingIds.has(rec.playerId) || ignoredIds.has(rec.playerId)) continue;

    const bidAmount = Math.ceil(rec.price * (1 + bidMargin / 100));

    if (rec.upgradePoints > 20 && bidAmount <= autoBidLimit && bidAmount <= balance) {
      // AUTO-PUJA: mejora clara y dentro del límite económico
      try {
        const success = await client.placeBid(rec.playerId, rec.name, bidAmount);
        result.autoBids.push({ ...rec, bidAmount, success });

        // Registrar en auditoría
        let log = [];
        try {
          if (fs.existsSync('audit_log.json')) {
            log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
          }
        } catch (e) {}
        log.push({
          timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          action: 'Puja Automática (Monitor Mercado)',
          player: rec.name,
          amount: `${bidAmount.toLocaleString()} €`,
          status: success ? 'Éxito' : 'Fallo'
        });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));
      } catch (e) {
        result.autoBids.push({ ...rec, bidAmount, success: false });
      }
    } else if (rec.upgradePoints > 5 && bidAmount <= balance) {
      // ALERTA MANUAL: mejora moderada o precio alto, pide confirmación
      result.manualAlerts.push({ ...rec, bidAmount });
    }
  }

  return result;
}
