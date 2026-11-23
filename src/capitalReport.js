import fs from 'node:fs';
import path from 'node:path';
import { ComunioEngine } from './engine.js';
import { calculateMarginalValue, calculateReplacementLoss } from './squadOptimizer.js';
import { amount, playerId, loadCapitalPolicy, committedCapital, assessSaleCapital, evaluateCapitalPurchase } from './capitalPolicy.js';
import { readCapitalState } from './capitalExecution.js';
import { isVerifiedComputerOwner } from './ownership.js';

const recent = p => amount(String(p.average?.lastXMatchdays?.points ?? '').replace(',', '.'));
export function planConditionalUpgrades({ squad, balance, committed, candidates, sales, engine, policy }) {
  const baseline = engine.optimizeLineup(squad).score || 0;
  const owned = new Set(squad.players.map(playerId));
  const salePool = [...new Map(sales.filter(s => owned.has(playerId(s)) && s.sportingAction !== 'KEEP_CORE').map(s => [playerId(s), s])).values()]
    .sort((a, b) => a.replacementLoss - b.replacementLoss).slice(0, 8);
  const wealth = balance + squad.players.reduce((sum, p) => sum + Number(p.price), 0);
  const plans = [];
  for (const candidate of candidates) {
    if (owned.has(playerId(candidate)) || !Number.isSafeInteger(candidate.price) || candidate.price <= 0 || !isVerifiedComputerOwner(candidate) || !engine.isPlayerAvailable(candidate) || !(recent(candidate) > 0) || candidate.price > wealth * policy.maxAssetShare) continue;
    let best = null;
    for (let mask = 1; mask < 2 ** salePool.length; mask++) {
      const selected = salePool.filter((_, i) => mask & (2 ** i));
      if (selected.length > 3) continue;
      const estimatedProceeds = selected.reduce((sum, p) => sum + p.price, 0);
      const cashAfter = balance + estimatedProceeds - committed - candidate.price;
      if (cashAfter < policy.reserve) continue;
      const outgoing = new Set(selected.map(playerId));
      const retained = squad.players.filter(p => !outgoing.has(playerId(p)));
      const notAwardedXI = engine.optimizeLineup({ ...squad, players: retained });
      const xiLossIfNotAwarded = Math.max(0, Math.round((baseline - (notAwardedXI.score || 0)) * 10) / 10);
      if (notAwardedXI.starting11?.length !== 11 || xiLossIfNotAwarded > 0) continue;
      const players = [...retained, candidate];
      if (players.length < 11 || players.length > policy.maxSquadSize) continue;
      const xi = engine.optimizeLineup({ ...squad, players });
      const netXIUpgrade = Math.round(((xi.score || 0) - baseline) * 10) / 10;
      if (xi.starting11?.length !== 11 || netXIUpgrade < policy.minXIUpgrade) continue;
      if (!best || netXIUpgrade > best.netXIUpgrade || (netXIUpgrade === best.netXIUpgrade && selected.length < best.sales.length)) {
        best = { playerId: playerId(candidate), name: candidate.name, price: candidate.price,
          sales: selected.map(s => ({ playerId: s.playerId, name: s.name, estimatedPrice: s.price, knownCost: s.purchasePrice })),
          estimatedProceeds, estimatedCashAfter: cashAfter, netXIUpgrade, requiresConfirmedSales: true,
          purchaseConfirmed: false, auctionWinProbability: null, cashIfAwarded: cashAfter,
          cashIfNotAwarded: balance + estimatedProceeds - committed, xiLossIfNotAwarded };
      }
    }
    if (best) plans.push(best);
  }
  return plans.sort((a, b) => b.netXIUpgrade - a.netXIUpgrade).slice(0, 3);
}
export async function createCapitalReport(client, { policy = loadCapitalPolicy(), statePath = 'data/capitalCommitments.json', context = null } = {}) {
  const data = context || await client.getPurchaseContext();
  const engine = new ComunioEngine();
  const state = readCapitalState(statePath);
  if (state.accountId != null && state.accountId !== data.accountId) throw new Error('El libro de capital pertenece a otra cuenta.');
  const owned = new Set(data.squad.players.map(playerId));
  const closed = new Set((data.closedBids || []).map(playerId));
  const pending = new Set(data.pendingBids.map(playerId));
  const reservations = state.reservations.filter(r => !owned.has(playerId(r)) && !(closed.has(playerId(r)) && !pending.has(playerId(r))));
  const commitments = committedCapital(data.pendingBids, reservations);
  const committed = commitments.total;
  const expectedPlayers = data.market.players.filter(p => commitments.ids.has(playerId(p)) && !owned.has(playerId(p)));
  const expectedIds = new Set([...commitments.ids].filter(id => !owned.has(id)));
  const completePendingData = expectedPlayers.length === expectedIds.size;
  const projectedSquad = { ...data.squad, players: [...data.squad.players, ...expectedPlayers] };
  const squadValue = data.squad.players.reduce((sum, p) => sum + Number(p.price), 0);
  if (![data.balance, data.credit, squadValue].every(Number.isSafeInteger)) throw new Error('No se dispone de finanzas verificables.');
  const currentXI = engine.optimizeLineup(data.squad);
  const candidates = data.market.players.filter(isVerifiedComputerOwner).filter(p => !owned.has(playerId(p))).map(candidate => {
    const marginal = calculateMarginalValue(engine, projectedSquad, candidate);
    const quality = { ...marginal, available: engine.isPlayerAvailable(candidate), recentAverage: recent(candidate) };
    const decision = evaluateCapitalPurchase({ ...data, candidate, bidAmount: amount(candidate.price), reservations, quality, policy });
    if (!completePendingData) { decision.allowed = false; decision.reason = 'PENDING_UPGRADE_DATA_MISSING'; }
    return { playerId: playerId(candidate), name: candidate.name, price: candidate.price, position: candidate.type,
      marginalValue: marginal.marginalValue, recentAverage: Number.isFinite(recent(candidate)) ? recent(candidate) : null,
      allowed: decision.allowed, reason: decision.reason, gainPerMillion: candidate.price > 0 ? marginal.marginalValue / (candidate.price / 1000000) : 0 };
  }).sort((a, b) => Number(b.allowed) - Number(a.allowed) || b.gainPerMillion - a.gainPerMillion);
  const sales = data.squad.players.map(player => {
    const loss = calculateReplacementLoss(engine, data.squad, player).replacementLoss;
    const assessment = assessSaleCapital({ player, offerPrice: Number(player.price), replacementLoss: loss });
    const protectedPlayer = player.type === 'keeper' || loss >= 2 || player.price >= 9000000;
    return { playerId: playerId(player), name: player.name, price: Number(player.price), purchasePrice: player.purchasePrice ?? null,
      recentAverage: Number.isFinite(recent(player)) ? recent(player) : null, replacementLoss: loss,
      sportingAction: protectedPlayer ? 'KEEP_CORE' : Number.isFinite(recent(player)) && recent(player) <= 1 ? 'REVIEW_SALE' : 'KEEP_OR_UPGRADE', ...assessment };
  });
  return { capturedAt: new Date().toISOString(), accountId: data.accountId, balance: data.balance, committed, reserve: policy.reserve,
    buyingPower: Math.max(0, data.balance - committed - policy.reserve), squadValue, wealth: data.balance + squadValue,
    squadCount: data.squad.players.length, maxSquadSize: policy.maxSquadSize, expectedXI: Math.round((currentXI.score || 0) * 10) / 10,
    formation: currentXI.formation, salesMode: 'MANUAL_ONLY', speculativePurchases: 'BLOCKED_WITHOUT_VERIFIED_EXIT',
    uncertainPurchases: reservations.filter(r => r.status === 'UNCERTAIN'), candidates, sales,
    conditionalPlans: commitments.ids.size ? [] : planConditionalUpgrades({ squad: data.squad, balance: data.balance, committed, candidates: data.market.players.filter(p => !owned.has(playerId(p))), sales, engine, policy }),
    note: 'El patrimonio fluctúa con VM y primas. Las proyecciones del once son estimaciones; no hay rentabilidad ni puntos garantizados.' };
}

export function explainPurchaseDecision(decision) {
  const explanations = {
    RESERVE_OR_CREDIT: 'La operación consumiría el colchón o superaría la caja o el crédito disponibles.',
    SQUAD_CAPACITY: 'Primero hay que reducir la plantilla mediante ventas confirmadas.',
    ASSET_CONCENTRATION: 'Demasiado patrimonio concentrado en un solo fichaje.',
    NO_RECENT_PLAYING_EVIDENCE: 'Faltan señales recientes de minutos o disponibilidad.',
    INSUFFICIENT_XI_UPGRADE: 'La mejora estimada del once no alcanza el mínimo exigido.',
    SPECULATION_REQUIRES_VERIFIED_EXIT: 'No se compra para especular basándose en una plusvalía hipotética.',
    ALREADY_COMMITTED: 'Ya existe una puja o dinero reservado por este jugador.',
    ALREADY_OWNED: 'El jugador ya está en la plantilla.',
    UNCERTAIN_RESPONSE: 'La respuesta de Comunio es incierta. Se mantiene la reserva: comprueba la puja antes de repetir.',
    PURCHASE_IN_PROGRESS: 'Hay otra compra en curso. La caja está bloqueada temporalmente.',
    PENDING_UPGRADE_DATA_MISSING: 'Faltan datos de una compra pendiente para comprobar si este jugador mejora el once.',
    API_REJECTED: 'Comunio ha rechazado expresamente la puja.',
    EXACT_MARKET_VALUE_REQUIRED: 'La puja debe coincidir con el valor de mercado actual.',
    UNVERIFIED_COMPUTER: 'El vendedor no está verificado como Computer.'
  };
  return explanations[decision?.reason] || 'No se puede verificar la operación con seguridad; no se ha autorizado la compra.';
}

export function formatCapitalReport(report) {
  const euro = n => Number(n).toLocaleString('es-ES') + ' €';
  const available = report.candidates.filter(c => c.allowed);
  const sales = report.sales.filter(s => s.sportingAction === 'REVIEW_SALE');
  return [
    'CAPITAL Y MEJORA DEL ONCE',
    `Caja: ${euro(report.balance)} · Compromisos: ${euro(report.committed)}`,
    `Reserva: ${euro(report.reserve)} · Poder de compra real: ${euro(report.buyingPower)}`,
    `Patrimonio observado: ${euro(report.wealth)} · Plantilla: ${report.squadCount}/${report.maxSquadSize}`,
    `Once estimado: ${report.formation} · ${report.expectedXI} puntos (estimación)`,
    'Las pujas pendientes no son compras ni gasto realizado. Los compromisos cubren el escenario de que se adjudiquen todas.',
    'Ventas: solo confirmación manual. No se usan ventas previstas ni primas futuras para pujar.',
    available.length ? 'Pujas candidatas, sin adjudicación garantizada: ' + available.slice(0, 3).map(c => `${c.name} (${euro(c.price)}, +${c.marginalValue.toFixed(1)} XI estimado solo si se adjudica)`).join('; ') : 'No hay pujas que superen todos los límites hoy.',
    sales.length ? 'Revisar ventas, sin ejecutarlas: ' + sales.map(s => `${s.name} (${euro(s.price)}, coste ${s.purchasePrice ? euro(s.purchasePrice) : 'desconocido'})`).join('; ') : 'No hay descartes evidentes por falta de rendimiento reciente.',
    ...(report.conditionalPlans || []).map(p => `Subasta condicionada: revisar ventas de ${p.sales.map(s => s.name).join(' + ')} a VM estimado y pujar por ${p.name} hasta ${euro(p.price)}. Si se adjudica: +${p.netXIUpgrade.toFixed(1)} XI estimado y caja ${euro(p.cashIfAwarded)}. Si se pierde: caja ${euro(p.cashIfNotAwarded)}, once completo sin pérdida estimada. No se conoce la probabilidad de ganar. Recalcular con ofertas reales antes de vender.`),
    report.uncertainPurchases.length ? `ATENCIÓN: ${report.uncertainPurchases.length} compras inciertas mantienen el dinero reservado; comprobar antes de repetir.` : '',
    report.note
  ].filter(Boolean).join('\n');
}

export function recordCapitalSnapshot(report, historyPath = 'data/capitalHistory.json') {
  const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : { accountId: report.accountId, snapshots: [] };
  if (history.accountId !== report.accountId || !Array.isArray(history.snapshots)) throw new Error('Histórico de capital inválido.');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(report.capturedAt));
  const snapshot = { day, capturedAt: report.capturedAt, balance: report.balance, committed: report.committed, wealth: report.wealth, expectedXI: report.expectedXI, squadCount: report.squadCount };
  // Preserve the first observation each day so reruns cannot rewrite its baseline.
  if (!history.snapshots.some(s => s.day === day)) history.snapshots.push(snapshot);
  history.snapshots = history.snapshots.slice(-120);
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  const temporary = `${historyPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(history, null, 2) + '\n');
  fs.renameSync(temporary, historyPath);
  return history;
}
