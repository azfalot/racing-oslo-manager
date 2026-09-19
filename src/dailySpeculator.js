import fs from 'fs';
import path from 'path';
import { scanSpeculationOpportunities, isPlayerFitForSpeculation } from './speculationRadar.js';
import { isVerifiedComputerOwner } from './ownership.js';
import { ComunioEngine } from './engine.js';

export const DEFAULT_LEDGER_PATH = 'data/speculationLedger.json';
export const DEFAULT_SAFETY_RESERVE_MIN_EUR = 50000;
export const MAX_SQUAD_CAPACITY = 15;

/**
 * Obtiene el conjunto de IDs del 11 titular óptimo para protegerlos contra auto-ventas.
 */
export function getStarting11Ids(squad, engine = null) {
  if (!squad || !squad.players || squad.players.length === 0) return new Set();
  try {
    const eng = engine || new ComunioEngine();
    const optimal = eng.optimizeLineup(squad);
    return new Set((optimal.starting11 || []).map(p => parseInt(p.playerId || p.id || 0)));
  } catch (e) {
    return new Set();
  }
}

export function loadSpeculationLedger(ledgerPath = DEFAULT_LEDGER_PATH) {
  try {
    if (fs.existsSync(ledgerPath)) {
      const data = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
      return {
        activeTradingPlayers: Array.isArray(data.activeTradingPlayers) ? data.activeTradingPlayers : [],
        closedTrades: Array.isArray(data.closedTrades) ? data.closedTrades : [],
        totalProfitEUR: typeof data.totalProfitEUR === 'number' ? data.totalProfitEUR : 0,
        successfulTradesCount: typeof data.successfulTradesCount === 'number' ? data.successfulTradesCount : 0,
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };
    }
  } catch (e) {
    console.warn('[DAILY-SPECULATOR] Error cargando ledger de ' + ledgerPath + ':', e.message);
  }

  return {
    activeTradingPlayers: [],
    closedTrades: [],
    totalProfitEUR: 0,
    successfulTradesCount: 0,
    lastUpdated: new Date().toISOString()
  };
}

export function saveSpeculationLedger(ledger, ledgerPath = DEFAULT_LEDGER_PATH) {
  try {
    const dir = path.dirname(ledgerPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const updatedLedger = {
      ...ledger,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(ledgerPath, JSON.stringify(updatedLedger, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[DAILY-SPECULATOR] Error guardando ledger en ' + ledgerPath + ':', e.message);
    return false;
  }
}

export async function executeDailySpeculationBids(client, squad = { players: [] }, currentBalance = 0, options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  const safetyReserveMin = options.safetyReserveMin !== undefined ? options.safetyReserveMin : DEFAULT_SAFETY_RESERVE_MIN_EUR;
  const maxSquadSize = options.maxSquadSize !== undefined ? options.maxSquadSize : MAX_SQUAD_CAPACITY;
  const dryRun = options.dryRun || false;
  const ledger = loadSpeculationLedger(ledgerPath);

  const currentPlayers = squad.players || [];
  const currentSquadIds = new Set(currentPlayers.map(p => parseInt(p.playerId || p.id || 0)));

  let pendingBids = [];
  try {
    if (client && typeof client.getPendingBids === 'function') {
      pendingBids = await client.getPendingBids();
    }
  } catch (e) {
    console.warn('[DAILY-SPECULATOR] Error obteniendo pujas pendientes:', e.message);
  }

  const pendingIds = new Set(pendingBids.map(b => parseInt(b.playerId || b.id || 0)));

  const occupiedSlots = currentPlayers.length + pendingBids.length;
  let availableSlots = Math.max(0, maxSquadSize - occupiedSlots);

  // Liquidez disponible respetando el colchón de seguridad
  let availableBiddingCap = Math.max(0, currentBalance - safetyReserveMin);

  console.log('[DAILY-SPECULATOR] Capacidad: ' + occupiedSlots + '/' + maxSquadSize + ' (' + availableSlots + ' libres) | Saldo: ' + currentBalance.toLocaleString() + ' EUR | Cap Especulacion: ' + availableBiddingCap.toLocaleString() + ' EUR');

  if (availableSlots <= 0 || availableBiddingCap <= 0) {
    return { executedBids: [], skippedOpportunities: [], remainingLiquidity: availableBiddingCap };
  }

  let marketPlayers = [];
  if (options.marketPlayers) {
    marketPlayers = options.marketPlayers;
  } else if (client && typeof client.getMarket === 'function') {
    const m = await client.getMarket();
    marketPlayers = m ? (m.players || []) : [];
  }

  const { opportunities } = scanSpeculationOpportunities(marketPlayers, squad, currentBalance);
  const executedBids = [];
  const skippedOpportunities = [];

  for (const opp of opportunities) {
    if (availableSlots <= 0) break;

    const pid = parseInt(opp.playerId || opp.id || 0);
    const price = opp.price;

    if (currentSquadIds.has(pid) || pendingIds.has(pid)) {
      skippedOpportunities.push({ name: opp.name, reason: 'ALREADY_OWNED_OR_PENDING' });
      continue;
    }

    if (!isVerifiedComputerOwner(opp)) {
      skippedOpportunities.push({ name: opp.name, reason: 'RIVAL_OWNER' });
      continue;
    }

    if (price > availableBiddingCap) {
      skippedOpportunities.push({ name: opp.name, reason: 'EXCEEDS_AVAILABLE_SPECULATION_CAP', price, availableBiddingCap });
      continue;
    }

    // 🛡️ BARRERA DE SEGURIDAD PRE-PUJA: Comprobación médica y de tendencia antes de emitir la puja
    if (!isPlayerFitForSpeculation(opp)) {
      skippedOpportunities.push({ name: opp.name, reason: 'FAILED_HEALTH_OR_TREND_VALIDATION' });
      console.warn('[DAILY-SPECULATOR] ⛔ Puja cancelada por alerta médica/tendencia: ' + opp.name + ' (' + (opp.status || '') + ' - ' + (opp.statusInfo || '') + ')');
      continue;
    }

    let success = false;
    if (dryRun) {
      success = true;
    } else if (client && typeof client.placeBid === 'function') {
      success = await client.placeBid(pid, opp.name, price);
    }

    if (success) {
      availableSlots--;
      availableBiddingCap -= price;

      // Registrar activo en el ledger para seguimiento contable
      if (!ledger.activeTradingPlayers.some(p => p.playerId === pid)) {
        ledger.activeTradingPlayers.push({
          playerId: pid,
          name: opp.name,
          buyPrice: price,
          buyDate: new Date().toISOString(),
          tier: opp.tier || 'FLOOR_PRICE_BARGAIN',
          listedOnMarket: false
        });
      }

      executedBids.push({
        playerId: pid,
        name: opp.name,
        price,
        tier: opp.tier,
        projectedUpsideEUR: opp.projectedUpsideEUR,
        timestamp: new Date().toISOString()
      });

      console.log('[DAILY-SPECULATOR] 🛒 Puja especulativa enviada: ' + opp.name + ' (' + price.toLocaleString() + ' EUR)');
    }
  }

  if (executedBids.length > 0) {
    saveSpeculationLedger(ledger, ledgerPath);
  }

  return {
    executedBids,
    skippedOpportunities,
    remainingLiquidity: availableBiddingCap
  };
}

export async function autoListSpeculationPlayers(client, squad = { players: [] }, options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  const ledger = loadSpeculationLedger(ledgerPath);
  const currentPlayers = squad.players || [];
  const activeTradingMap = new Map(ledger.activeTradingPlayers.map(p => [p.playerId, p]));
  const listedPlayers = [];
  for (const player of currentPlayers) {
    const pid = player.playerId || player.id;
    const tradingRecord = activeTradingMap.get(pid);
    if (!tradingRecord) continue;

    // 📈 JUGADORES DE ESPECULACIÓN O TRANSFERIBLES: Si no están activos en el mercado de Comunio, listarlos de inmediato
    const isActuallyOnMarket = player.onMarket === true || (player.onMarket === undefined && Boolean(tradingRecord.listedOnMarket));
    if (!isActuallyOnMarket) {
      const askPrice = player.price || tradingRecord.buyPrice || 160000;
      let success = false;

      if (options.dryRun) {
        success = true;
      } else if (client && typeof client.listPlayerOnMarket === 'function') {
        success = await client.listPlayerOnMarket(pid, askPrice);
      } else if (client && typeof client.sellPlayer === 'function') {
        success = await client.sellPlayer(pid, player.name, askPrice);
      }

      if (success) {
        tradingRecord.listedOnMarket = true;
        tradingRecord.listedPrice = askPrice;
        tradingRecord.listedDate = new Date().toISOString();
        listedPlayers.push({
          playerId: pid,
          name: player.name,
          askPrice
        });
        console.log('[DAILY-SPECULATOR] 🏷️ Puesto en venta para ofertas de Computer: ' + player.name + ' (' + askPrice.toLocaleString() + ' EUR)');
      }
    }
  }

  if (listedPlayers.length > 0) {
    saveSpeculationLedger(ledger, ledgerPath);
  }

  return listedPlayers;
}

export function evaluateSpeculationOffers(saleOffers = [], options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  const minSpreadRatio = options.minSpreadRatio !== undefined ? options.minSpreadRatio : 1.00;
  const ledger = loadSpeculationLedger(ledgerPath);
  const activeTradingMap = new Map(ledger.activeTradingPlayers.map(p => [p.playerId, p]));

  const toAccept = [];
  const toHoldOrReject = [];

  for (const offer of saleOffers) {
    const pid = offer.tradable ? offer.tradable.id : offer.playerId;
    const playerName = offer.tradable ? offer.tradable.name : (offer.playerName || 'Desconocido');
    const offerPrice = offer.price || 0;
    const buyerName = (offer.user && offer.user.name) || (offer.tradingPartner && offer.tradingPartner.name) || 'Computer';

    const tradingRecord = activeTradingMap.get(pid);
    if (!tradingRecord) continue;

    const buyPrice = tradingRecord.buyPrice || 0;
    const profitEUR = offerPrice - buyPrice;
    const roiPct = buyPrice > 0 ? ((profitEUR / buyPrice) * 100) : 0;

    if (offerPrice > buyPrice && (buyPrice <= 0 || (offerPrice / buyPrice) >= minSpreadRatio)) {
      toAccept.push({
        offerId: offer.id || offer.offerId,
        playerId: pid,
        name: playerName,
        buyPrice,
        offerPrice,
        profitEUR,
        roiPct: Math.round(roiPct * 10) / 10,
        buyer: buyerName,
        decision: 'ACCEPT',
        reason: 'Spread positivo: +' + profitEUR.toLocaleString() + ' EUR (+' + Math.round(roiPct) + '% ROI)'
      });
    } else {
      toHoldOrReject.push({
        offerId: offer.id || offer.offerId,
        playerId: pid,
        name: playerName,
        buyPrice,
        offerPrice,
        profitEUR,
        decision: 'HOLD',
        reason: 'Oferta insuficiente (' + offerPrice.toLocaleString() + ' EUR <= Compra ' + buyPrice.toLocaleString() + ' EUR). Se mantiene.'
      });
    }
  }

  return { toAccept, toHoldOrReject };
}

export async function executeSpeculationOfferAcceptances(client, saleOffers = [], options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  const dryRun = options.dryRun || false;
  const ledger = loadSpeculationLedger(ledgerPath);

  const { toAccept, toHoldOrReject } = evaluateSpeculationOffers(saleOffers, { ...options, ledgerPath });
  const acceptedTrades = [];
  let totalProfitAddedEUR = 0;

  for (const item of toAccept) {
    let success = false;
    if (dryRun) {
      success = true;
    } else if (client && typeof client.acceptSaleOffer === 'function') {
      success = await client.acceptSaleOffer(item.offerId, item.playerId, item.offerPrice);
    }

    if (success) {
      ledger.activeTradingPlayers = ledger.activeTradingPlayers.filter(p => p.playerId !== item.playerId);

      const tradeRecord = {
        playerId: item.playerId,
        name: item.name,
        buyPrice: item.buyPrice,
        sellPrice: item.offerPrice,
        profitEUR: item.profitEUR,
        roiPct: item.roiPct,
        sellDate: new Date().toISOString()
      };
      ledger.closedTrades.push(tradeRecord);
      ledger.totalProfitEUR += item.profitEUR;
      ledger.successfulTradesCount += 1;

      totalProfitAddedEUR += item.profitEUR;
      acceptedTrades.push(tradeRecord);

      console.log('[DAILY-SPECULATOR] Venta ejecutada: ' + item.name + ' por ' + item.offerPrice.toLocaleString() + ' EUR | Beneficio neto: +' + item.profitEUR.toLocaleString() + ' EUR');
    }
  }

  if (acceptedTrades.length > 0) {
    saveSpeculationLedger(ledger, ledgerPath);
  }

  return {
    acceptedTrades,
    heldOffers: toHoldOrReject,
    totalProfitAddedEUR
  };
}

export function syncLedgerWithNewSignings(currentSquadPlayers = [], recentBids = [], options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  const ledger = loadSpeculationLedger(ledgerPath);
  const activeIds = new Set(ledger.activeTradingPlayers.map(p => p.playerId));
  const squadMap = new Map(currentSquadPlayers.map(p => [p.playerId || p.id, p]));

  let updated = false;

  for (const bid of recentBids) {
    const pid = bid.playerId || bid.id;
    if (squadMap.has(pid) && !activeIds.has(pid)) {
      const squadPlayer = squadMap.get(pid);
      ledger.activeTradingPlayers.push({
        playerId: pid,
        name: squadPlayer.name || bid.name,
        buyPrice: bid.price,
        buyDate: new Date().toISOString(),
        tier: bid.tier || 'FLOOR_PRICE_BARGAIN',
        listedOnMarket: false
      });
      activeIds.add(pid);
      updated = true;
      console.log('[DAILY-SPECULATOR] Nuevo activo especulativo incorporado: ' + squadPlayer.name + ' (' + bid.price.toLocaleString() + ' EUR)');
    }
  }

  if (updated) {
    saveSpeculationLedger(ledger, ledgerPath);
  }

  return ledger;
}
