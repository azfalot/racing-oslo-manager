import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { ComunioClient } from './comunioClient.js';
import { buildTransferPlan } from './transferPlan.js';

// Read-only unless --list is explicitly supplied. No sales, bids or public posts.
const client = new ComunioClient();
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex < 0 ? 'web/src/data/transferPlan.json' : process.argv[outputIndex + 1];
if (!output || output.startsWith('--')) throw new Error('Falta la ruta de --output.');
try {
  await client.login();
  const get = async url => (await axios.get(url, { headers: client.getHeaders(), timeout: 15000 })).data;
  const [profile, squad, market, offers, listings] = await Promise.all([
    get('https://api.comunio.es/'), client.getSquad(), client.getMarket(),
    get(`https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/offers?current`),
    get(`https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/exchangemarket`)
  ]);
  const numeric = value => value === null || value === undefined || value === '' ? NaN : Number(value);
  if (!squad.players?.length || !Array.isArray(offers.items) || !Array.isArray(listings.items)) {
    throw new Error('Respuesta incompleta de Comunio; no se realizarán operaciones.');
  }
  const plan = buildTransferPlan({ squad, market, balance: numeric(profile.user?.budget), credit: numeric(offers.credit),
    pendingBids: offers.items.filter(p => p.type === 'PURCHASE' && p.state === 'PENDING').map(p => ({ playerId: p.tradable?.id, price: numeric(p.price) })) });
  plan.actions = [];
  if (process.argv.includes('--list')) {
    const scenario = plan.scenarios.find(s => s.feasible);
    if (!scenario || !plan.target?.computer || plan.owned) throw new Error('Sin objetivo Computer o financiación viable; no se listará la plantilla.');
    const ours = new Set(listings.items.filter(p => Number(p._embedded?.owner?.id) === Number(client.userId)).map(p => Number(p._embedded?.player?.id)));
    for (const player of scenario.plan.sales) {
      const action = { playerId: player.playerId, name: player.name, price: player.price, status: 'ALREADY_LISTED' };
      if (!ours.has(player.playerId)) {
        action.status = await client.listPlayerOnMarket(player.playerId, player.price) ? 'REQUESTED' : 'FAILED';
      }
      plan.actions.push(action);
    }
    const verified = await get(`https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/exchangemarket`);
    if (!Array.isArray(verified.items)) throw new Error('No se pudo verificar el resultado del mercado.');
    const verifiedIds = new Set(verified.items.filter(p => Number(p._embedded?.owner?.id) === Number(client.userId)).map(p => Number(p._embedded?.player?.id)));
    for (const action of plan.actions) action.status = verifiedIds.has(action.playerId) ? 'LISTED_VERIFIED' : 'UNVERIFIED';
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify({ capturedAt: plan.capturedAt, output, balance: plan.availableCash, credit: plan.credit,
    scenarios: plan.scenarios.map(s => ({ price: s.price, feasible: s.feasible, sales: s.plan?.sales, replacements: s.plan?.replacementBudget })), actions: plan.actions }, null, 2));
  if (plan.actions.some(a => a.status !== 'LISTED_VERIFIED')) process.exitCode = 1;
} catch (error) {
  console.error(`[TRANSFER-PLAN] ${error.message}`);
  process.exitCode = 1;
}
