import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSpeculationOpportunities, INJURY_RECOVERY_INTEL } from '../src/speculationRadar.js';

function createMockMarketPlayer(id, name, type, price, ownerName = 'Computer', points = 0, avg = '0') {
  const isComp = ownerName.toLowerCase() === 'computer';
  return {
    id,
    playerId: id,
    name,
    type,
    position: type,
    price,
    quotedPrice: price,
    owner: { id: isComp ? 1 : 100, name: ownerName },
    ownerId: isComp ? 1 : 100,
    ownerName,
    points,
    average: { points: avg }
  };
}

// ── TEST SUITE: SPECULATION RADAR & TRADING ───────────────────────────────────

test('1. Speculation Radar: Identifies Gavi as top CRACK_RECOVERY opportunity', () => {
  const market = [
    createMockMarketPlayer(3160, 'Gavi', 'midfielder', 1910000, 'Computer'),
    createMockMarketPlayer(1876, 'Denis Suárez', 'midfielder', 1400000, 'Computer', 18, '4.5'),
    createMockMarketPlayer(2847, 'Iker Losada', 'midfielder', 170000, 'Computer')
  ];

  const result = scanSpeculationOpportunities(market, { players: new Array(11) }, 500000);
  assert.ok(result.opportunities.length >= 3, 'Must identify all valid computer targets');

  const gavi = result.opportunities.find(o => o.name === 'Gavi');
  assert.ok(gavi, 'Gavi must be found in opportunities');
  assert.equal(gavi.tier, 'CRACK_RECOVERY');
  assert.ok(gavi.estimatedRoiPct >= 100, 'Gavi ROI must be >= 100%');
  assert.ok(gavi.projectedUpsideEUR > 5000000, 'Gavi upside must be > 5M€');
});

test('2. Speculation Radar: Identifies floor price bargains (< 300k €) with zero risk', () => {
  const market = [
    createMockMarketPlayer(2847, 'Iker Losada', 'midfielder', 170000, 'Computer')
  ];

  const result = scanSpeculationOpportunities(market);
  const bargain = result.opportunities[0];

  assert.equal(bargain.tier, 'FLOOR_PRICE_BARGAIN');
  assert.equal(bargain.downsideRisk, 'CERO (Precio mínimo garantizado por Comunio)');
  assert.ok(bargain.projectedUpsideEUR > 0);
});

test('3. Speculation Radar: Denies non-Computer owned players for automated speculation flips', () => {
  const market = [
    createMockMarketPlayer(3160, 'Gavi', 'midfielder', 1910000, 'Ana'),
    createMockMarketPlayer(2847, 'Iker Losada', 'midfielder', 170000, 'Puente Avios')
  ];

  const result = scanSpeculationOpportunities(market);
  assert.equal(result.opportunities.length, 0, 'Must ignore non-Computer players for automated speculation');
});
