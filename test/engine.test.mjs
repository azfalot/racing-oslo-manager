import test from 'node:test';
import assert from 'node:assert/strict';
import { ComunioEngine } from '../src/engine.js';
import {
  calculateSquadValue,
  calculateMarginalValue,
  calculateReplacementLoss,
  calculatePositionNeed,
  getExpectedPerformance,
  calculateStrategicPurchaseScore,
  calculateMaxRationalBid,
  evaluateIncomingOffer,
  evaluateSalePortfolio,
  evaluatePostSigningSale
} from '../src/squadOptimizer.js';

// Helper to create mock players
function createPlayer(id, name, type, price, avgPoints = 4.0, historicalPoints = 100, status = 'ACTIVE') {
  return {
    id,
    playerId: id,
    name,
    type,
    position: type,
    price,
    quotedPrice: price,
    status,
    statusInfo: '',
    available: status === 'ACTIVE',
    average: { points: String(avgPoints) },
    historical: [{ season: '23/24', points: String(historicalPoints) }]
  };
}

// Sample balanced squad
function createMockSquad() {
  return {
    userId: 100,
    players: [
      createPlayer(1, 'Courtois', 'keeper', 6000000, 5.0, 160),
      createPlayer(2, 'Rudiger', 'defender', 5000000, 4.5, 140),
      createPlayer(3, 'Koundé', 'defender', 5500000, 4.8, 150),
      createPlayer(4, 'Giménez', 'defender', 3500000, 4.0, 120),
      createPlayer(5, 'Vivian', 'defender', 3000000, 3.8, 110),
      createPlayer(6, 'Pedri', 'midfielder', 12000000, 6.5, 190),
      createPlayer(7, 'Valverde', 'midfielder', 11000000, 6.2, 180),
      createPlayer(8, 'De Jong', 'midfielder', 8000000, 5.2, 150),
      createPlayer(9, 'Brais Méndez', 'midfielder', 6000000, 4.8, 140),
      createPlayer(10, 'Galarreta', 'midfielder', 4000000, 4.2, 120),
      createPlayer(11, 'Oriol Rey', 'midfielder', 800000, 2.5, 60),
      createPlayer(12, 'Vinicius', 'striker', 16000000, 7.5, 220),
      createPlayer(13, 'Gerard Moreno', 'striker', 7000000, 5.0, 150),
      createPlayer(14, 'Hugo Duro', 'striker', 4000000, 3.8, 110)
    ]
  };
}

// ── PURCHASE TESTS ─────────────────────────────────────────────────────────────

test('1. Candidate beats worst player but does NOT improve best XI -> no aggressive bid (PASS or low score)', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const balance = 10000000;

  // Candidate midfielder: 90 pts. Beats Oriol Rey (60 pts), but the starting midfield
  // has Pedri (190), Valverde (180), De Jong (150), Brais (140), Galarreta (120).
  // In a 3-5-2 or 4-4-2, 90 pts will NOT enter starting XI.
  const candidate = createPlayer(99, 'Midfielder Decent', 'midfielder', 3000000, 3.5, 90);

  const { marginalValue, entersXI } = calculateMarginalValue(engine, squad, candidate);
  assert.equal(marginalValue, 0, 'Marginal XI upgrade should be 0 because candidate does not enter XI');
  assert.equal(entersXI, false, 'Candidate should not enter the optimal XI');

  const purchaseScore = calculateStrategicPurchaseScore(engine, candidate, squad, balance);
  assert.equal(purchaseScore.action, 'PASS', 'Should recommend PASS when XI upgrade is 0 and position is not in critical need');
});

test('2. Candidate genuinely upgrades starting XI -> strategic score increases', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const balance = 20000000;

  // Candidate: Bellingham (220 pts) -> Massive upgrade
  const candidate = createPlayer(100, 'Bellingham', 'midfielder', 18000000, 7.8, 230);

  const { marginalValue, entersXI } = calculateMarginalValue(engine, squad, candidate);
  assert.ok(marginalValue > 0, 'Marginal value should be positive');
  assert.equal(entersXI, true, 'Bellingham must enter starting XI');

  const purchaseScore = calculateStrategicPurchaseScore(engine, candidate, squad, balance);
  assert.ok(purchaseScore.score >= 50, `Strategic score should be high for a crack (got ${purchaseScore.score})`);
  assert.equal(purchaseScore.entersXI, true);
});

test('3. Superstar opportunity with low cash -> valuation remains high but affordability constrains action', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const lowBalance = 1500000; // Only 1.5M in bank

  const superstar = createPlayer(101, 'Mbappé', 'striker', 20000000, 8.0, 240);

  const purchaseScore = calculateStrategicPurchaseScore(engine, superstar, squad, lowBalance);
  // Strategic sporting score is independent of balance
  assert.ok(purchaseScore.score >= 50, 'Sporting value must remain high even with 0 cash');

  // But bidding / affordability constrains action
  const bidCalc = calculateMaxRationalBid(superstar, purchaseScore, lowBalance);
  assert.equal(bidCalc.canAfford, false, 'Must flag that the club cannot afford');
  assert.equal(bidCalc.action, 'PASS', 'Cannot afford -> action becomes PASS');
});

test('4. Expensive player with poor points-per-million -> valuation penalized appropriately', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const balance = 15000000;

  // Expensive 14M player who only averages 3.0 pts (PPM low)
  const overpriced = createPlayer(102, 'Overpriced Star', 'striker', 14000000, 3.0, 75);

  const perf = getExpectedPerformance(overpriced);
  assert.ok(perf.efficiency < 10, `Efficiency should be low (got ${perf.efficiency})`);

  const purchaseScore = calculateStrategicPurchaseScore(engine, overpriced, squad, balance);
  assert.ok(purchaseScore.components.marketOpportunity.raw < 30, 'Market opportunity component should be penalized');
});

test('5. Strong positional need increases valuation', () => {
  const engine = new ComunioEngine();
  // Squad with only 1 striker
  const squadWithFewStrikers = {
    userId: 100,
    players: [
      createPlayer(1, 'Courtois', 'keeper', 6000000, 5.0, 160),
      createPlayer(2, 'Rudiger', 'defender', 5000000, 4.5, 140),
      createPlayer(3, 'Koundé', 'defender', 5500000, 4.8, 150),
      createPlayer(4, 'Giménez', 'defender', 3500000, 4.0, 120),
      createPlayer(5, 'Vivian', 'defender', 3000000, 3.8, 110),
      createPlayer(6, 'Pedri', 'midfielder', 12000000, 6.5, 190),
      createPlayer(7, 'Valverde', 'midfielder', 11000000, 6.2, 180),
      createPlayer(8, 'De Jong', 'midfielder', 8000000, 5.2, 150),
      createPlayer(9, 'Brais Méndez', 'midfielder', 6000000, 4.8, 140),
      createPlayer(10, 'Galarreta', 'midfielder', 4000000, 4.2, 120),
      createPlayer(12, 'Vinicius', 'striker', 16000000, 7.5, 220) // Only 1 striker!
    ]
  };

  const posNeed = calculatePositionNeed(engine, squadWithFewStrikers, 'striker');
  assert.ok(posNeed.need >= 0.70, `Positional need for striker should be critical (got ${posNeed.need})`);

  const strikerCandidate = createPlayer(103, 'Average Striker', 'striker', 3000000, 4.0, 100);
  const score = calculateStrategicPurchaseScore(engine, strikerCandidate, squadWithFewStrikers, 10000000);
  assert.ok(score.components.positionNeed.raw >= 70, 'Position need component should be high');
});

test('6. Rival pressure may increase recommended bid but never beyond maximum rational bid', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const balance = 15000000;

  const candidate = createPlayer(104, 'Good Midfielder', 'midfielder', 5000000, 5.5, 160);
  const purchaseScore = calculateStrategicPurchaseScore(engine, candidate, squad, balance);

  const rivalIntelAggressive = { avgCommunityOverbid: 12.0 };
  const bidCalc = calculateMaxRationalBid(candidate, purchaseScore, balance, rivalIntelAggressive);

  assert.ok(bidCalc.recommendedBid <= bidCalc.maxRationalBid,
    `Recommended bid (${bidCalc.recommendedBid}) must NOT exceed max rational bid (${bidCalc.maxRationalBid})`);
});

// ── SALE TESTS ─────────────────────────────────────────────────────────────────

test('7. Negative balance does NOT accept a terrible offer automatically', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const negativeBalance = -100000; // Small debt: -100k

  // Star player: VM 8M, terrible offer: 5.3M (34% discount)
  const starPlayer = squad.players.find(p => p.id === 8); // De Jong (8M)
  const lowballOffer = { price: 5300000, user: { id: 2, name: 'Lowballer' } };

  const evalResult = evaluateIncomingOffer(engine, starPlayer, lowballOffer, squad, negativeBalance);
  assert.equal(evalResult.shouldAccept, false, 'Must NOT accept terrible lowball offer even in debt');
  assert.notEqual(evalResult.action, 'ACCEPT_OFFER', 'Action must not be ACCEPT_OFFER');
});

test('8. Small debt chooses a low-impact sale instead of sacrificing a star', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const requiredDebt = 500000; // 500k debt

  const portfolio = evaluateSalePortfolio(engine, squad, requiredDebt);
  assert.ok(portfolio.suggestedSales.length > 0, 'Must suggest sale candidates');

  // Should suggest Oriol Rey (800k, backup) instead of Vinicius/Pedri/Courtois
  const soldNames = portfolio.suggestedSales.map(s => s.name);
  assert.ok(soldNames.includes('Oriol Rey'), 'Should pick cheap backup Oriol Rey');
  assert.ok(!soldNames.includes('Vinicius'), 'Must NEVER sacrifice Vinicius for 500k debt');
  assert.ok(!soldNames.includes('Pedri'), 'Must NEVER sacrifice Pedri for 500k debt');
});

test('9. Two cheap fringe-player sales can be preferred over one expensive key-player sale', () => {
  const engine = new ComunioEngine();
  // Construct squad where 2 cheap bench players can cover 1.5M debt with 0 sporting loss
  const squad = createMockSquad();
  const requiredCash = 1400000;

  const portfolio = evaluateSalePortfolio(engine, squad, requiredCash);
  assert.ok(portfolio.totalSportingLoss < 15, `Sporting loss should be minimal (got ${portfolio.totalSportingLoss})`);
  assert.ok(portfolio.totalCash >= requiredCash, 'Total cash must cover required debt');
});

test('10. A high-scoring but redundant player can be sold if not core to XI', () => {
  const engine = new ComunioEngine();
  // Squad with 6 high-scoring midfielders where 6th midfielder doesn't fit in any XI formation
  const squad = createMockSquad();

  // Hugo Duro (striker 3, 110 pts) in a squad that plays 3-5-2 with Vinicius + Gerard Moreno
  // Removing Hugo Duro causes 0 or minimal replacement loss
  const duro = squad.players.find(p => p.name === 'Hugo Duro');
  const { replacementLoss } = calculateReplacementLoss(engine, squad, duro);

  // In 3-5-2, Duro is on the bench, so loss is small
  assert.ok(replacementLoss <= 10, `Replacement loss should be small for bench striker (got ${replacementLoss})`);

  // Good offer on Duro (above market value)
  const goodOffer = { price: 4600000, user: { id: 1, name: 'Computer' } }; // VM is 4M (+15%)
  const evalResult = evaluateIncomingOffer(engine, duro, goodOffer, squad, 5000000);
  assert.equal(evalResult.shouldAccept, false, 'No offer may be accepted without a human Telegram confirmation');
  assert.equal(evalResult.action, 'REQUIRE_CONFIRMATION', 'A valid offer must require manual approval');
});

test('11. A lower-scoring core player is protected because replacement loss is high', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();

  // Courtois is our ONLY keeper (160 pts). If sold, replacement loss is massive (-4 missing player penalty + 160 pts)
  const keeper = squad.players.find(p => p.type === 'keeper');
  const { replacementLoss } = calculateReplacementLoss(engine, squad, keeper);
  assert.ok(replacementLoss >= 50, `Keeper replacement loss must be high (got ${replacementLoss})`);

  const offer = { price: 7000000, user: { id: 2, name: 'Rival' } };
  const evalResult = evaluateIncomingOffer(engine, keeper, offer, squad, 5000000);
  assert.equal(evalResult.shouldAccept, false, 'Must reject offer for lone core keeper');
});

test('12. No sale is triggered when squad and liquidity benefit from keeping both players', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad(); // 14 players (< 15 capacity)
  const balance = 10000000;

  const newSigning = createPlayer(105, 'Sorloth', 'striker', 8000000, 5.5, 170);
  const result = evaluatePostSigningSale(engine, newSigning, squad, balance);

  assert.equal(result.shouldSell, false, 'Should NOT trigger a sale when squad has room and positive balance');
});

// ── SAFETY TESTS ───────────────────────────────────────────────────────────────

test('13. High-value transaction requires confirmation according to autoBidLimit', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const balance = 30000000;

  // Star candidate priced at 12M (> 8M autoBidLimit in manual mode)
  const star = createPlayer(106, 'Superstar Mid', 'midfielder', 12000000, 6.8, 200);
  star.owner = { id: 1, name: 'Computer' };

  const purchaseScore = calculateStrategicPurchaseScore(engine, star, squad, balance);
  
  // Test manual confirmation mode
  const manualStrategy = {
    purchase: { maxBidOverMarketPct: 15.0, safetyReservePct: 0.15, safetyReserveMin: 1000000 },
    liquidity: { fullAutonomousMode: false, autoBidLimit: 8000000, criticalPurchasePctBalance: 0.40 }
  };
  const bidCalcManual = calculateMaxRationalBid(star, purchaseScore, balance, null, manualStrategy);
  assert.equal(bidCalcManual.action, 'REQUIRE_CONFIRMATION', 'Must require manual confirmation when fullAutonomousMode is false');

  // Test full autonomous mode
  const autoStrategy = {
    purchase: { maxBidOverMarketPct: 15.0, safetyReservePct: 0.15, safetyReserveMin: 1000000 },
    liquidity: { fullAutonomousMode: true, autoBidLimit: 50000000, criticalPurchasePctBalance: 0.90 }
  };
  const bidCalcAuto = calculateMaxRationalBid(star, purchaseScore, balance, null, autoStrategy);
  assert.equal(bidCalcAuto.action, 'AUTO_BID', 'Must auto-bid directly when fullAutonomousMode is true');
});

test('14. Engine lineup optimization remains deterministic and valid', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();

  const lineup1 = engine.optimizeLineup(squad);
  const lineup2 = engine.optimizeLineup(squad);

  assert.equal(lineup1.formation, lineup2.formation, 'Formations must match');
  assert.equal(lineup1.score, lineup2.score, 'Scores must be identical');
  assert.equal(lineup1.starting11.length, 11, 'Must select exactly 11 starters');
});

test('15. Sanctioned, red-banned, or suspended player is discarded (PASS) and rival-owned player gets no extra margin', () => {
  const engine = new ComunioEngine();
  const squad = createMockSquad();
  const balance = 15000000;

  // Case A: Red-banned player (like Le Normand status RED_BANNED or cards.red = 1)
  const bannedPlayer = {
    id: 999,
    playerId: 999,
    name: 'Banned Defender',
    type: 'defender',
    price: 4000000,
    status: 'RED_BANNED',
    cards: { red: 1, yellow: 0, yellowRed: 0 },
    owner: { id: 2, name: 'Rival Manager' },
    average: { points: '5.0' },
    historical: [{ points: '140' }]
  };

  assert.equal(engine.isPlayerAvailable(bannedPlayer), false, 'isPlayerAvailable must return false for RED_BANNED');

  const purchaseScore = calculateStrategicPurchaseScore(engine, bannedPlayer, squad, balance);
  assert.equal(purchaseScore.action, 'PASS', 'Strategic score must output PASS for sanctioned player');

  // Case B: Available player owned by human rival manager -> no extra margin
  const rivalPlayer = {
    id: 998,
    playerId: 998,
    name: 'Rival Star Defender',
    type: 'defender',
    price: 5000000,
    status: 'ACTIVE',
    cards: { red: 0, yellow: 0, yellowRed: 0 },
    owner: { id: 21163674, name: 'Fermín Gadura F.C.' },
    average: { points: '5.5' },
    historical: [{ points: '150' }]
  };

  const rivalScore = calculateStrategicPurchaseScore(engine, rivalPlayer, squad, balance);
  const rivalBid = calculateMaxRationalBid(rivalPlayer, rivalScore, balance);
  assert.equal(rivalBid.marginPct, 0, 'Must NOT offer extra overbid margin (+0%) when buying from a human rival manager');
});

test('16. Positional club competition evaluates depth chart, direct rivals and starter confidence', async () => {
  const { evaluateClubCompetition } = await import('../src/clubCompetition.js');

  // Case A: FC Barcelona defender (Christensen) competing with Cubarsi, Araujo, Kounde
  const christensen = {
    name: 'Andreas Christensen',
    club: 'FC Barcelona',
    type: 'defender',
    average: { points: '4.2' },
    historical: [{ points: '134' }]
  };
  const compBarca = evaluateClubCompetition(christensen);
  assert.ok(compBarca.directRivals.length > 0, 'Must identify Barcelona defensive rivals');
  assert.ok(compBarca.directRivals.some(r => r.includes('Cubarsí') || r.includes('Araujo')), 'Must include top teammates in depth chart');
  assert.ok(compBarca.confidencePct >= 70, 'Must calculate confident starter probability for experienced international');

  // Case B: Undisputed star (Gerard Moreno in Villarreal)
  const gerard = {
    name: 'Gerard Moreno',
    club: 'Villarreal CF',
    type: 'striker',
    average: { points: '6.5' },
    historical: [{ points: '180' }]
  };
  const compVillarreal = evaluateClubCompetition(gerard);
  assert.equal(compVillarreal.isUndisputed, true, 'Gerard Moreno must be classified as undisputed starter');
  assert.equal(compVillarreal.competitionLevel, 'BAJA', 'Undisputed starter must have BAJA competition level');
});
