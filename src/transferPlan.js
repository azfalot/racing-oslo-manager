import { isVerifiedComputerOwner } from './ownership.js';

const formations = [[3, 4, 3], [3, 5, 2], [4, 4, 2], [4, 3, 3], [5, 3, 2], [5, 4, 1]];
const positions = ['keeper', 'defender', 'midfielder', 'striker'];
const id = p => Number(p.playerId ?? p.id);
const value = p => Number(p.price ?? p.quotedPrice);
const average = p => Number(String(p.average?.points ?? 0).replace(',', '.')) || 0;

/** Estimates only: listing a player never increases spendable cash. */
export function buildTransferPlan({ squad, market, balance, pendingBids = [], credit, targetId = 3409,
  prices = [30000000, 32500000, 35000000], squadSize = 13, replacementPrice = 500000, reserve = 500000,
  capturedAt = new Date().toISOString() }) {
  const players = squad?.players ?? [];
  const marketPlayers = market?.players ?? [];
  if (!Number.isFinite(balance) || !Number.isFinite(credit) || credit < 0 ||
    !Number.isInteger(squadSize) || squadSize < 11 || !Number.isFinite(replacementPrice) ||
    replacementPrice < 160000 || replacementPrice >= 1000000 || !Number.isFinite(reserve) || reserve < 0 ||
    !prices.length || prices.some(p => !Number.isSafeInteger(p) || p <= 0) ||
    pendingBids.some(p => !Number.isFinite(Number(p.price)) || Number(p.price) < 0) ||
    players.length > 22 || players.some(p => !Number.isSafeInteger(id(p)) || !positions.includes(p.type ?? p.position) ||
      !Number.isFinite(value(p)) || value(p) <= 0) || new Set(players.map(id)).size !== players.length) {
    throw new Error('Datos financieros o plantilla inválidos; no se puede calcular el plan.');
  }
  const target = marketPlayers.find(p => id(p) === targetId);
  if (target && (!positions.includes(target.type ?? target.position) || !Number.isFinite(value(target)) || value(target) <= 0)) {
    throw new Error('Datos del objetivo inválidos.');
  }
  const owned = players.some(p => id(p) === targetId);
  const committed = pendingBids.filter(p => Number(p.playerId) !== targetId).reduce((sum, p) => sum + Number(p.price), 0);
  const availableCash = balance - committed;
  const teamValue = players.reduce((sum, p) => sum + value(p), 0);
  const eligible = players.filter(p => id(p) !== targetId);
  const scenarios = prices.map(price => ({ price, feasible: false, plan: null }));
  // Enumerate portfolios rather than sell the cheapest players until the account is empty.
  if (target && isVerifiedComputerOwner(target) && !owned) for (let mask = 0; mask < 2 ** eligible.length; mask++) {
    let proceeds = 0;
    let count = 0;
    let retainedQuality = 0;
    const counts = [0, 0, 0, 0];
    counts[positions.indexOf(target.type ?? target.position)]++;
    for (let i = 0; i < eligible.length; i++) {
      const p = eligible[i];
      if (mask & (2 ** i)) { proceeds += value(p); count++; }
      else { counts[positions.indexOf(p.type ?? p.position)]++; retainedQuality += average(p); }
    }
    const retainedCount = eligible.length - count + 1;
    let best = null;
    for (const [d, m, s] of formations) {
      const deficits = [1, d, m, s].map((needed, i) => Math.max(0, needed - counts[i]));
      const replacements = Math.max(deficits.reduce((a, b) => a + b, 0), squadSize - retainedCount);
      if (!best || replacements < best.replacements) best = { formation: `${d}-${m}-${s}`, deficits, replacements };
    }
    const replacementBudget = best.replacements * replacementPrice;
    for (const scenario of scenarios) {
      const cashAfterSigning = availableCash + proceeds - scenario.price;
      const spare = cashAfterSigning - replacementBudget - reserve;
      if (spare < 0) continue;
      const score = retainedQuality;
      if (scenario.plan && score <= scenario.plan.retainedQuality) continue;
      const sales = eligible.filter((_, i) => mask & (2 ** i));
      scenario.feasible = true;
      scenario.plan = { sales: sales.map(p => ({ playerId: id(p), name: p.name, price: value(p), position: p.type ?? p.position })),
        proceeds, retainedQuality: score, retained: eligible.filter((_, i) => !(mask & (2 ** i))).map(p => ({ playerId: id(p), name: p.name, position: p.type ?? p.position })),
        formation: best.formation, missingPositions: Object.fromEntries(positions.map((p, i) => [p, best.deficits[i]])),
        replacements: best.replacements, replacementBudget, cashAfterSigning, spare };
    }
  }
  const cheapCandidates = marketPlayers.filter(p => isVerifiedComputerOwner(p) && id(p) !== targetId && value(p) > 0 && value(p) < 1000000 &&
    !players.some(own => id(own) === id(p)) && p.status === 'ACTIVE').map(p => ({
    playerId: id(p), name: p.name, price: value(p), position: p.type ?? p.position,
    average: average(p), recentAverage: Number(String(p.average?.lastXMatchdays?.points ?? 0).replace(',', '.')) || 0,
    owner: p.owner?.name ?? 'Desconocido', computer: isVerifiedComputerOwner(p)
  })).sort((a, b) => b.recentAverage - a.recentAverage || a.price - b.price);
  return { capturedAt, target: target ? { playerId: id(target), name: target.name, price: value(target), computer: isVerifiedComputerOwner(target) } : null,
    owned, availableCash, committed, credit, teamValue, totalWealth: balance + teamValue, squadSize, replacementPrice, reserve,
    canBidNow: target && isVerifiedComputerOwner(target) && !owned ? prices[0] <= credit - committed && prices[0] <= availableCash - reserve : false,
    scenarios, cheapCandidates,
    warning: 'Ventas estimadas a valor de mercado, sin garantizar ofertas ni adjudicación. Los recambios son una provisión de gasto; no garantizan titulares disponibles.' };
}
