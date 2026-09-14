import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  loadSpeculationLedger,
  saveSpeculationLedger,
  executeDailySpeculationBids,
  autoListSpeculationPlayers,
  evaluateSpeculationOffers,
  executeSpeculationOfferAcceptances,
  syncLedgerWithNewSignings
} from '../src/dailySpeculator.js';

test('Speculation Ledger - Initialization and Persistence', () => {
  const testPath = 'data/test_speculation_ledger.json';
  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);

  const initial = loadSpeculationLedger(testPath);
  assert.equal(initial.totalProfitEUR, 0);
  assert.equal(initial.activeTradingPlayers.length, 0);
  assert.equal(initial.closedTrades.length, 0);

  initial.activeTradingPlayers.push({
    playerId: 999,
    name: 'Chollo Test',
    buyPrice: 180000,
    buyDate: new Date().toISOString(),
    tier: 'FLOOR_PRICE_BARGAIN',
    listedOnMarket: false
  });
  saveSpeculationLedger(initial, testPath);

  const reloaded = loadSpeculationLedger(testPath);
  assert.equal(reloaded.activeTradingPlayers.length, 1);
  assert.equal(reloaded.activeTradingPlayers[0].name, 'Chollo Test');

  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
});

test('Execute Daily Speculation Bids - Safety Reserve and Capacity Constraints', async () => {
  const mockMarket = [
    { playerId: 101, name: 'Gavi', price: 1910000, owner: {id: 1, name: 'Computer' } },
    { playerId: 102, name: 'Parche Barato', price: 170000, owner: {id: 1, name: 'Computer' } },
    { playerId: 103, name: 'Chollo Extra', price: 250000, owner: { id: 1, name: 'Computer' } },
    { playerId: 104, name: 'Rival Floor', price: 200000, owner: { id: 99, name: 'Campeon Rival' } }
  ];

  const mockSquad = { players: [
    { playerId: 1, name: 'Gerard Moreno', price: 3900000 },
    { playerId: 2, name: 'Valverde', price: 10500000 }
  ] };

  // Caso 1: Saldo de 1.200.000 €, safetyReserveMin de 1.000.000 € -> 200.000 ₫ disponible
  // Solo debe pujar por Parche Barato (170k) e ignorar Gavi (1.91M) y Chollo Extra (250k) por exceder cap
  const res = await executeDailySpeculationBids(
    null,
    mockSquad,
    1200000,
    {
      marketPlayers: mockMarket,
      safetyReserveMin: 1000000,
      maxSquadSize: 15,
      dryRun: true
    }
  );

  assert.equal(res.executedBids.length, 1);
  assert.equal(res.executedBids[0].name, 'Parche Barato');
  assert.equal(res.executedBids[0].price, 170000);
  assert.ok(res.remainingLiquidity >= 0);

  // Caso 2: Plantilla completa (15 jugadores) -> 0 pujas permitidas
  const fullSquad = { players: Array(15).fill(0).map((_, i) => ({ playerId: i + 10, name: 'Player ' + i })) };
  const fullRes = await executeDailySpeculationBids(
    null,
    fullSquad,
    5000000,
    {
      marketPlayers: mockMarket,
      safetyReserveMin: 1000000,
      maxSquadSize: 15,
      dryRun: true
    }
  );
  assert.equal(fullRes.executedBids.length, 0);
});

test('Auto-List Speculation Players on Market', async () => {
  const testPath = 'data/test_list_ledger.json';
  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);

  const ledger = {
    activeTradingPlayers: [
      { playerId: 501, name: 'Trading Player 1', buyPrice: 200000, listedOnMarket: false },
      { playerId: 502, name: 'Already Listed', buyPrice: 220000, listedOnMarket: true }
    ],
    closedTrades: [],
    totalProfitEUR: 0,
    successfulTradesCount: 0
  };
  saveSpeculationLedger(ledger, testPath);

  const squad = { players: [
    { playerId: 501, name: 'Trading Player 1', price: 210000 },
    { playerId: 502, name: 'Already Listed', price: 240000 },
    { playerId: 900, name: 'Core Player', price: 5000000 }
  ] };

  const listed = await autoListSpeculationPlayers(null, squad, { ledgerPath: testPath, dryRun: true });

  assert.equal(listed.length, 1);
  assert.equal(listed[0].playerId, 501);
  assert.equal(listed[0].askPrice, 210000);

  const updated = loadSpeculationLedger(testPath);
  const p101 = updated.activeTradingPlayers.find(p => p.playerId === 501);
  assert.ok(p101.listedOnMarket === true);

  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
});

test('Evaluate and Execute Speculation Sale Offers - Strict Profit Spreading', async () => {
  const testPath = 'data/test_offers_ledger.json';
  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);

  const ledger = {
    activeTradingPlayers: [
      { playerId: 601, name: 'Chollo Profitable', buyPrice: 200000, listedOnMarket: true },
      { playerId: 602, name: 'Chollo Undervalued', buyPrice: 200000, listedOnMarket: true }
    ],
    closedTrades: [],
    totalProfitEUR: 0,
    successfulTradesCount: 0
  };
  saveSpeculationLedger(ledger, testPath);

  const saleOffers = [
    // Oferta 1: 240.000 € (ganancia +40k sobre 200k)
    { offerId: 11, playerId: 601, price: 240000, tradable: { id: 601, name: 'Chollo Profitable' } },
    // Oferta 2: 190.000 € (pérdida -10k, nunca aceptar)
    { offerId: 12, playerId: 602, price: 190000, tradable: { id: 602, name: 'Chollo Undervalued' } },
    // Oferta 3: jugador no registrado en trading (plantilla titular)
    { offerId: 13, playerId: 701, price: 6000000, tradable: { id: 701, name: 'Gerard Moreno' } }
  ];

  const { toAccept, toHoldOrReject } = evaluateSpeculationOffers(saleOffers, { ledgerPath: testPath });

  assert.equal(toAccept.length, 1);
  assert.equal(toAccept[0].playerId, 601);
  assert.equal(toAccept[0].profitEUR, 40000);
  assert.equal(toAccept[0].buyPrice, 200000);

  assert.equal(toHoldOrReject.length, 1);
  assert.equal(toHoldOrReject[0].playerId, 602);

  // Ejecutar aceptación con actualización del libro
  const executionRes = await executeSpeculationOfferAcceptances(null, saleOffers, {
    ledgerPath: testPath,
    dryRun: true
  });

  assert.equal(executionRes.acceptedTrades.length, 1);
  assert.equal(executionRes.totalProfitAddedEUR, 40000);

  const finalLedger = loadSpeculationLedger(testPath);
  assert.equal(finalLedger.activeTradingPlayers.length, 1); // Queda el 602
  assert.equal(finalLedger.closedTrades.length, 1);
  assert.equal(finalLedger.totalProfitEUR, 40000);
  assert.equal(finalLedger.successfulTradesCount, 1);

  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
});

test('Sync Ledger with New Signings', () => {
  const testPath = 'data/test_sync_ledger.json';
  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);

  const currentSquadPlayers = [
    { playerId: 801, name: 'Nuevo Chollo Fichado', price: 190000 },
    { playerId: 802, name: 'Titular de Siempre', price: 4000000 }
  ];

  const recentBids = [
    { playerId: 801, name: 'Nuevo Chollo Fichado', price: 190000, tier: 'FLOOR_PRICE_BARGAIN' }
  ];

  const synced = syncLedgerWithNewSignings(currentSquadPlayers, recentBids, { ledgerPath: testPath });
  assert.equal(synced.activeTradingPlayers.length, 1);
  assert.equal(synced.activeTradingPlayers[0].playerId, 801);
  assert.equal(synced.activeTradingPlayers[0].buyPrice, 190000);

  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
});
