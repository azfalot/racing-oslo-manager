import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { ComunioClient } from '../src/comunioClient.js';
import { executeSpeculationOfferAcceptances, saveSpeculationLedger } from '../src/dailySpeculator.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('sale API denies unconfirmed sales before authentication or network access', async () => {
  const c = new ComunioClient();
  c.isLoggedIn = true;
  let requests = 0;
  const original = axios.post;
  axios.post = async () => { requests++; return { status: 200, data: { status: 'OK' } }; };
  try {
    for (const options of [undefined, {}, { confirmedByUser: false }, { confirmedByUser: 'true' }]) {
      assert.equal(await c.acceptSaleOffer(1, 2415, 12220000, options), false);
    }
    assert.equal(requests, 0);
  } finally { axios.post = original; }
});

test('only explicitly confirmed manual sale reaches the API', async () => {
  const c = new ComunioClient();
  c.isLoggedIn = true;
  c.communityId = 1;
  c.userId = 2;
  let requests = 0;
  const original = axios.post;
  axios.post = async (_url, body) => { requests++; assert.equal(body.offers[0].type, 'ACCEPT'); return { status: 200, data: { status: 'OK' } }; };
  try {
    assert.equal(await c.acceptSaleOffer(1, 2415, 12220000, { confirmedByUser: true }), true);
    assert.equal(requests, 1);
  } finally { axios.post = original; }
});

test('autonomous trading cannot sell at a profit or clear debt through the real client', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oslo-manual-sales-'));
  const original = axios.post;
  let requests = 0;
  axios.post = async () => { requests++; return { status: 200, data: { status: 'OK' } }; };
  try {
    const ledgerPath = join(dir, 'ledger.json');
    saveSpeculationLedger({ activeTradingPlayers: [{ playerId: 100, name: 'Trading', buyPrice: 100000 }], closedTrades: [], totalProfitEUR: 0, successfulTradesCount: 0 }, ledgerPath);
    const c = new ComunioClient(); c.isLoggedIn = true;
    for (const currentBalance of [1000000, -1000000]) {
      const result = await executeSpeculationOfferAcceptances(c, [{ id: 1, tradable: { id: 100, name: 'Trading' }, price: 200000 }], { ledgerPath, currentBalance });
      assert.deepEqual(result.acceptedTrades, []);
    }
    assert.equal(requests, 0);
  } finally { axios.post = original; rmSync(dir, { recursive: true, force: true }); }
});
