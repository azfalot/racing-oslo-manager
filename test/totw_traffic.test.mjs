import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { evaluatePlayerTotwStats, getSquadTotwSummary, SEASON_26_27_TOTW_REGISTRY } from '../src/totwTracker.js';

function createMockPlayer(id, name, type, price, club = 'Unknown', expPts = 6.5) {
  return {
    id,
    playerId: id,
    name,
    type,
    position: type,
    price,
    quotedPrice: price,
    clubName: club,
    expectedPoints: expPts,
    historicalPoints: [{ season: '23/24', points: 150 }]
  };
}

// ── TEST SUITE: TOTW & WEB TRAFFIC TELEMETRY ──────────────────────────────────

test('1. TOTW Tracker: Registry contains valid matchday Onces Ideales', () => {
  assert.ok(Array.isArray(SEASON_26_27_TOTW_REGISTRY), 'TOTW Registry must be an array');
  assert.ok(SEASON_26_27_TOTW_REGISTRY.length >= 4, 'Must have recorded matchdays 1 through 4');

  const j1 = SEASON_26_27_TOTW_REGISTRY[0];
  assert.equal(j1.matchday, 1);
  assert.equal(j1.lineup.length, 11, 'Lineup must contain 11 players');
  assert.ok(j1.mvp, 'MVP must be specified');
});

test('2. TOTW Tracker: Evaluates squad player appearances and next round candidacy', () => {
  const gerard = createMockPlayer(1927, 'Gerard Moreno', 'striker', 8950000, 'Villarreal', 7.5);
  const stats = evaluatePlayerTotwStats(gerard);

  assert.equal(stats.appearancesThisSeason, 0, 'Gerard Moreno has 0 TOTW appearances this season');
  assert.ok(stats.allTimeCareerAppearances > 0, 'Gerard Moreno has career appearances recorded');
  assert.equal(stats.isCandidateNextRound, true, 'High expected points flags candidacy for next round');
  assert.ok(stats.candidacyProbability > 40, 'Candidacy probability must be calculated');
});

test('3. TOTW Tracker: getSquadTotwSummary aggregates full squad audit', () => {
  const squad = {
    players: [
      createMockPlayer(1, 'David Soria', 'keeper', 4000000, 'Getafe', 7.3),
      createMockPlayer(2, 'Gerard Moreno', 'striker', 8950000, 'Villarreal', 7.0),
      createMockPlayer(3, 'Federico Valverde', 'midfielder', 16000000, 'Real Madrid', 6.5)
    ]
  };

  const summary = getSquadTotwSummary(squad);
  assert.equal(summary.totalAppearancesThisSeason, 0);
  assert.ok(summary.totalCareerAppearances > 0);
  assert.equal(summary.playerStats.length, 3);
  assert.ok(summary.topCandidates.length >= 2);
});

test('4. Web Traffic: trafficStats.json contains complete valid schema', () => {
  const filePath = 'web/src/data/trafficStats.json';
  assert.ok(fs.existsSync(filePath), 'trafficStats.json must exist');

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert.ok(data.overview.totalPageViews > 0);
  assert.ok(data.overview.uniqueVisitors > 0);
  assert.ok(Array.isArray(data.topPages));
  assert.ok(data.cloudflareObservability.workerId === 'racing-oslo');
});
