import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { evaluateCapitalPurchase, playerId } from './capitalPolicy.js';

const writeState = (file, state) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(temporary, file);
};

export function readCapitalState(file = 'data/capitalCommitments.json') {
  if (!fs.existsSync(file)) return { accountId: null, reservations: [] };
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(state.reservations)) throw new Error('Libro de compromisos inválido.');
  return state;
}

export function releaseCapitalReservation({ candidateId, accountId, statePath = 'data/capitalCommitments.json', lockPath = '.capital-purchase.lock' }) {
  const token = acquire(lockPath);
  if (!token) return false;
  try {
    const state = readCapitalState(statePath);
    if (state.accountId != null && state.accountId !== accountId) return false;
    state.accountId = accountId;
    state.reservations = state.reservations.filter(r => playerId(r) !== Number(candidateId));
    writeState(statePath, state);
    return true;
  } finally {
    if (JSON.parse(fs.readFileSync(lockPath, 'utf8')).token === token) fs.unlinkSync(lockPath);
  }
}

function acquire(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const token = randomUUID();
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
    return token;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const prior = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Number.isInteger(prior.pid) || prior.pid <= 0) return null;
    try { process.kill(prior.pid, 0); return null; } catch (e) { if (e.code !== 'ESRCH') return null; }
    fs.unlinkSync(file);
    return acquire(file);
  }
}

export async function executeCapitalPurchase({ loadContext, submit, evaluateQuality, candidateId, bidAmount, confirmedByUser = false,
  purpose = 'upgrade', policy, statePath = 'data/capitalCommitments.json', lockPath = '.capital-purchase.lock' }) {
  let token;
  try {
    token = acquire(lockPath);
    if (!token) return { allowed: false, reason: 'PURCHASE_IN_PROGRESS' };
    const context = await loadContext();
    const state = readCapitalState(statePath);
    if (!Number.isSafeInteger(context.accountId) || context.accountId <= 0 || (state.accountId != null && state.accountId !== context.accountId)) throw new Error('Cuenta de compromisos incompatible.');
    state.accountId = context.accountId;
    const owned = new Set(context.squad.players.map(playerId));
    const closed = new Set((context.closedBids || []).map(playerId));
    const pending = new Set(context.pendingBids.map(playerId));
    state.reservations = state.reservations.filter(r => !owned.has(playerId(r)) && !(closed.has(playerId(r)) && !pending.has(playerId(r))));
    const candidate = context.market.players.find(p => playerId(p) === Number(candidateId));
    const expectedIds = new Set([...context.pendingBids, ...state.reservations].map(playerId).filter(id => !owned.has(id)));
    const expectedPlayers = context.market.players.filter(p => expectedIds.has(playerId(p)));
    if (confirmedByUser !== true && expectedPlayers.length !== expectedIds.size) return { allowed: false, reason: 'PENDING_UPGRADE_DATA_MISSING' };
    // Compare against the XI if every earlier commitment succeeds. Two bids
    // must not both claim the improvement from replacing the same weak starter.
    const projectedSquad = { ...context.squad, players: [...context.squad.players, ...expectedPlayers] };
    const quality = candidate ? await evaluateQuality(candidate, projectedSquad) : {};
    const decision = evaluateCapitalPurchase({ ...context, candidate, bidAmount, quality, reservations: state.reservations, confirmedByUser, purpose, policy });
    writeState(statePath, state);
    if (!decision.allowed) return decision;
    // Reserve before the request: a timeout may mean the server accepted it.
    const reservation = { playerId: Number(candidateId), price: bidAmount, createdAt: new Date().toISOString(), status: 'SUBMITTING' };
    state.reservations.push(reservation);
    writeState(statePath, state);
    try {
      const response = await submit(candidate, bidAmount);
      if (response?.status === 'ERROR' || response?.response?.some(r => r.status === 'ERROR')) {
        state.reservations = state.reservations.filter(r => r !== reservation);
        writeState(statePath, state);
        return { ...decision, allowed: false, reason: 'API_REJECTED' };
      }
      const verified = response?.status === 'OK' && Array.isArray(response.response) && response.response.length > 0 && response.response.every(r => r.status === 'OK');
      reservation.status = verified ? 'SUBMITTED' : 'UNCERTAIN';
      writeState(statePath, state);
      return { ...decision, allowed: verified, reason: verified ? 'SUBMITTED' : 'UNCERTAIN_RESPONSE', playerId: Number(candidateId) };
    } catch {
      reservation.status = 'UNCERTAIN';
      writeState(statePath, state);
      return { ...decision, allowed: false, reason: 'UNCERTAIN_RESPONSE' };
    }
  } catch (error) {
    return { allowed: false, reason: 'CAPITAL_DATA_UNAVAILABLE', detail: error.message };
  } finally {
    if (token && fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (lock.token === token) fs.unlinkSync(lockPath);
    }
  }
}
