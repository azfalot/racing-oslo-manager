import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateCapitalPurchase, committedCapital, assessSaleCapital, loadCapitalPolicy } from '../src/capitalPolicy.js';
import { executeCapitalPurchase, readCapitalState } from '../src/capitalExecution.js';

const squad = { players: Array.from({ length: 11 }, (_, i) => ({ playerId: i + 1, price: 2000000 })) };
const player = (id = 100, price = 600000) => ({ playerId: id, name: 'Upgrade', price, owner: { id: 1, name: 'Computer' } });
const quality = { entersXI: true, marginalValue: 1.5, available: true, recentAverage: 4 };
const input = { candidate: player(), bidAmount: 600000, balance: 2000000, credit: 7000000, squad, quality };
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'oslo-purchase-')); return { dir, statePath: join(dir, 'state.json'), lockPath: join(dir, 'lock') }; };
const setup = storage => ({ ...storage, candidateId: 100, bidAmount: 600000, evaluateQuality: async () => quality,
  loadContext: async () => ({ accountId: 1, balance: 2000000, credit: 7000000, squad, market: { players: [player(), player(101)] }, pendingBids: [] }),
  submit: async () => ({ status: 'OK', response: [{ status: 'OK' }] }) });

test('reserve is protected and local/API commitments are not counted twice', () => {
  assert.equal(committedCapital([{ playerId: 3, price: '600000' }], [{ playerId: 3, price: 600000 }]).total, 600000);
  const decision = evaluateCapitalPurchase({ ...input, pendingBids: [{ playerId: 90, price: '500000' }] });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'RESERVE_OR_CREDIT');
});

test('rejects bad data, rival/unknown seller, overbid, duplicate and capacity', () => {
  const cases = [{ balance: NaN }, { credit: NaN }, { bidAmount: 600001 }, { candidate: { ...player(), owner: null } },
    { candidate: { ...player(), owner: { id: 2, name: 'Rival' } } }, { candidate: player(1) },
    { pendingBids: [{ playerId: 100, price: 600000 }] }, { squad: { players: Array.from({ length: 15 }, (_, i) => ({ playerId: i + 1, price: 2000000 })) } }];
  for (const override of cases) assert.equal(evaluateCapitalPurchase({ ...input, ...override }).allowed, false);
});

test('automated buys require playing evidence and real XI improvement; manual buys retain cash limits', () => {
  for (const override of [{ entersXI: false }, { marginalValue: 0.1 }, { available: false }, { recentAverage: 0 }]) {
    assert.equal(evaluateCapitalPurchase({ ...input, quality: { ...quality, ...override } }).allowed, false);
  }
  assert.equal(evaluateCapitalPurchase({ ...input, confirmedByUser: true, quality: {} }).allowed, true);
  assert.equal(evaluateCapitalPurchase({ ...input, balance: 1000000, confirmedByUser: true }).allowed, false);
  assert.equal(evaluateCapitalPurchase({ ...input, purpose: 'speculation' }).allowed, false);
  assert.equal(evaluateCapitalPurchase({ ...input, balance: 20000000, credit: 20000000, squad: { players: [] }, candidate: player(100,10000000), bidAmount: 10000000 }).reason, 'ASSET_CONCENTRATION');
});

test('write-ahead reservations protect cash when the next API response is stale', async () => {
  const storage = temp();
  try {
    const first = await executeCapitalPurchase(setup(storage));
    const second = await executeCapitalPurchase({ ...setup(storage), candidateId: 101 });
    assert.equal(first.allowed, true);
    assert.equal(second.reason, 'RESERVE_OR_CREDIT');
    assert.equal(readCapitalState(storage.statePath).reservations.length, 1);
  } finally { rmSync(storage.dir, { recursive: true, force: true }); }
});

test('concurrent purchase workers cannot spend the same cash', async () => {
  const storage = temp();
  try {
    const results = await Promise.all([executeCapitalPurchase(setup(storage)), executeCapitalPurchase({ ...setup(storage), candidateId: 101 })]);
    assert.equal(results.filter(r => r.allowed).length, 1);
    assert.ok(results.some(r => r.reason === 'PURCHASE_IN_PROGRESS'));
  } finally { rmSync(storage.dir, { recursive: true, force: true }); }
});

test('network uncertainty keeps the commitment and never retries a purchase', async () => {
  const storage = temp();
  let requests = 0;
  try {
    const request = { ...setup(storage), submit: async () => { requests++; throw new Error('timeout'); } };
    assert.equal((await executeCapitalPurchase(request)).reason, 'UNCERTAIN_RESPONSE');
    assert.equal((await executeCapitalPurchase(request)).reason, 'ALREADY_COMMITTED');
    assert.equal(requests, 1);
    assert.equal(readCapitalState(storage.statePath).reservations[0].status, 'UNCERTAIN');
  } finally { rmSync(storage.dir, { recursive: true, force: true }); }
});

test('earlier pending upgrades count in the XI and cannot justify redundant buys', async () => {
  const storage = temp();
  try {
    const request = setup(storage);
    const context = await request.loadContext();
    context.balance = 5000000;
    context.pendingBids = [{ playerId: 100, price: 600000 }];
    const result = await executeCapitalPurchase({ ...request, candidateId: 101, loadContext: async () => context,
      evaluateQuality: async (_candidate, projected) => ({ ...quality, marginalValue: projected.players.some(p => p.playerId === 100) ? 0 : 2 }) });
    assert.equal(result.reason, 'INSUFFICIENT_XI_UPGRADE');
    context.market = { players: [player(101)] };
    const unavailable = await executeCapitalPurchase({ ...request, candidateId: 101, loadContext: async () => context });
    assert.equal(unavailable.reason, 'PENDING_UPGRADE_DATA_MISSING');
    assert.deepEqual(readCapitalState(storage.statePath).reservations, []);
  } finally { rmSync(storage.dir, { recursive: true, force: true }); }
});

test('API rejection releases funds; malformed success keeps them reserved', async () => {
  const storage = temp();
  try {
    const response = await executeCapitalPurchase({ ...setup(storage), submit: async () => ({ status: 'OK', response: [{ status: 'ERROR' }] }) });
    assert.equal(response.reason, 'API_REJECTED');
    assert.deepEqual(readCapitalState(storage.statePath).reservations, []);
    assert.equal((await executeCapitalPurchase({ ...setup(storage), submit: async () => ({}) })).reason, 'UNCERTAIN_RESPONSE');
    assert.equal(readCapitalState(storage.statePath).reservations.length, 1);
  } finally { rmSync(storage.dir, { recursive: true, force: true }); }
});

test('invalid journal, another account or unavailable snapshot blocks all requests', async () => {
  const storage = temp();
  let requests = 0;
  try {
    const base = { ...setup(storage), submit: async () => { requests++; } };
    writeFileSync(storage.statePath, '{broken');
    assert.equal((await executeCapitalPurchase(base)).reason, 'CAPITAL_DATA_UNAVAILABLE');
    writeFileSync(storage.statePath, JSON.stringify({ accountId: 99, reservations: [] }));
    assert.equal((await executeCapitalPurchase(base)).reason, 'CAPITAL_DATA_UNAVAILABLE');
    assert.equal((await executeCapitalPurchase({ ...base, loadContext: async () => { throw new Error('offline'); } })).reason, 'CAPITAL_DATA_UNAVAILABLE');
    assert.equal(requests, 0);
  } finally { rmSync(storage.dir, { recursive: true, force: true }); }
});

test('sales expose actual loss and never invent a cost basis or auto-accept', () => {
  const loss = assessSaleCapital({ player: { price: 1000000, purchasePrice: 1500000 }, offerPrice: 1050000 });
  assert.equal(loss.action, 'REVIEW_LOSS'); assert.equal(loss.profit, -450000); assert.equal(loss.suggestedMinimum, 1500000);
  const unknown = assessSaleCapital({ player: { price: 1000000 }, offerPrice: 1050000 });
  assert.equal(unknown.profit, null); assert.equal(unknown.requiresConfirmation, true);
});

test('invalid capital policy cannot silently weaken defaults', () => {
  const storage = temp();
  try {
    writeFileSync(storage.statePath, JSON.stringify({ strategy: { capital: { reserve: -1 } } }));
    assert.throws(() => loadCapitalPolicy(storage.statePath), /inválida/);
    writeFileSync(storage.statePath, JSON.stringify({}));
    assert.equal(loadCapitalPolicy(storage.statePath).reserve, 1000000);
  } finally { rmSync(storage.dir, { recursive: true, force: true }); }
});
