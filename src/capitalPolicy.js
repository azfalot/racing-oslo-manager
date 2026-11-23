import fs from 'node:fs';
import { isVerifiedComputerOwner } from './ownership.js';

export const DEFAULT_CAPITAL_POLICY = Object.freeze({ reserve: 1000000, maxSquadSize: 15, minXIUpgrade: 0.75, maxAssetShare: 0.35 });
export const amount = value => value == null || value === '' || typeof value === 'boolean' ? NaN : Number(value);
export const playerId = player => Number(player.playerId ?? player.id);

export function loadCapitalPolicy(configPath = 'config.json') {
  const configured = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')).strategy?.capital : {};
  const policy = { ...DEFAULT_CAPITAL_POLICY, ...configured };
  if (!Number.isSafeInteger(policy.reserve) || policy.reserve < 0 || !Number.isInteger(policy.maxSquadSize) || policy.maxSquadSize < 11 ||
    !Number.isFinite(policy.minXIUpgrade) || policy.minXIUpgrade < 0 || !Number.isFinite(policy.maxAssetShare) || policy.maxAssetShare <= 0 || policy.maxAssetShare > 1) {
    throw new Error('Política de capital inválida.');
  }
  return policy;
}

export function committedCapital(pending = [], reservations = []) {
  const byPlayer = new Map();
  for (const bid of [...pending, ...reservations]) {
    const pid = playerId(bid);
    const price = amount(bid.price);
    if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isSafeInteger(price) || price <= 0) throw new Error('Compromiso de compra inválido.');
    byPlayer.set(pid, Math.max(byPlayer.get(pid) || 0, price));
  }
  return { total: [...byPlayer.values()].reduce((sum, price) => sum + price, 0), ids: new Set(byPlayer.keys()) };
}

export function evaluateCapitalPurchase({ candidate, bidAmount, balance, credit, squad, pendingBids = [], reservations = [], quality = {}, confirmedByUser = false, purpose = 'upgrade', policy = DEFAULT_CAPITAL_POLICY }) {
  const reject = reason => ({ allowed: false, reason });
  if (![balance, credit, bidAmount].every(v => Number.isSafeInteger(v)) || credit < 0 || bidAmount <= 0 || !Array.isArray(squad?.players)) return reject('INVALID_FINANCES');
  if (!candidate || !isVerifiedComputerOwner(candidate)) return reject('UNVERIFIED_COMPUTER');
  const price = amount(candidate.price ?? candidate.quotedPrice);
  if (!Number.isSafeInteger(price) || price <= 0 || bidAmount !== price) return reject('EXACT_MARKET_VALUE_REQUIRED');
  const owned = new Set(squad.players.map(playerId));
  if (owned.has(playerId(candidate))) return reject('ALREADY_OWNED');
  const commitments = committedCapital(pendingBids, reservations);
  if (commitments.ids.has(playerId(candidate))) return reject('ALREADY_COMMITTED');
  const available = Math.max(0, balance - commitments.total - policy.reserve);
  if (bidAmount > available || bidAmount + commitments.total > credit) return { ...reject('RESERVE_OR_CREDIT'), available, committed: commitments.total };
  if (owned.size + commitments.ids.size >= policy.maxSquadSize) return reject('SQUAD_CAPACITY');
  const squadValue = squad.players.reduce((sum, p) => sum + amount(p.price ?? p.quotedPrice), 0);
  if (!Number.isSafeInteger(squadValue) || squadValue < 0) return reject('INVALID_SQUAD_VALUE');
  if (bidAmount > (balance + squadValue) * policy.maxAssetShare) return reject('ASSET_CONCENTRATION');
  // Heuristic returns and a low price are not evidence of a profitable resale.
  if (purpose === 'speculation') return reject('SPECULATION_REQUIRES_VERIFIED_EXIT');
  if (confirmedByUser !== true) {
    if (quality.available !== true || !(quality.recentAverage > 0)) return reject('NO_RECENT_PLAYING_EVIDENCE');
    if (quality.entersXI !== true || !(quality.marginalValue >= policy.minXIUpgrade)) return reject('INSUFFICIENT_XI_UPGRADE');
  }
  return { allowed: true, reason: 'FUNDED_XI_UPGRADE', available, committed: commitments.total, cashAfterAllBids: balance - commitments.total - bidAmount };
}

export function assessSaleCapital({ player, offerPrice, purchasePrice = null, replacementLoss = 0 }) {
  const marketValue = amount(player?.price ?? player?.quotedPrice);
  const price = amount(offerPrice);
  const cost = amount(purchasePrice ?? player?.purchasePrice);
  if (!Number.isSafeInteger(marketValue) || marketValue <= 0 || !Number.isSafeInteger(price) || price <= 0) return { action: 'HOLD', reason: 'INVALID_SALE_DATA', requiresConfirmation: true };
  const knownCost = Number.isSafeInteger(cost) && cost > 0;
  const floor = Math.max(marketValue, knownCost ? cost : 0);
  return { action: price < floor ? 'REVIEW_LOSS' : replacementLoss >= 1 ? 'REVIEW_SPORTING_LOSS' : 'REVIEW_SALE',
    requiresConfirmation: true, marketValue, offerPrice: price, purchasePrice: knownCost ? cost : null,
    profit: knownCost ? price - cost : null, vsMarket: price - marketValue, suggestedMinimum: floor, replacementLoss };
}
