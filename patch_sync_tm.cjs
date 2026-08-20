const fs = require('fs');

let content = fs.readFileSync('src/syncWeb.mjs', 'utf8');

if (!content.includes('getTransfermarktData')) {
  content = content.replace("import axios from 'axios';", "import axios from 'axios';\nimport { getTransfermarktData } from './transfermarkt.js';");
  
  // Patch Squad TM Data
  content = content.replace(
    "fs.writeFileSync('./web/src/data/squad.json', JSON.stringify(squadJson, null, 2));",
    `
  // TM Data for Squad
  for (const p of squadJson.players) {
    const tm = await getTransfermarktData(p.name);
    p.tmValue = tm ? tm.value : 0;
  }
  fs.writeFileSync('./web/src/data/squad.json', JSON.stringify(squadJson, null, 2));
    `
  );

  // Patch Market TM Data
  content = content.replace(
    "fs.writeFileSync('./web/src/data/market.json', JSON.stringify(marketJson, null, 2));",
    `
  // TM Data for Market
  for (const p of marketJson) {
    const tm = await getTransfermarktData(p.name);
    p.tmValue = tm ? tm.value : 0;
  }
  fs.writeFileSync('./web/src/data/market.json', JSON.stringify(marketJson, null, 2));
    `
  );

  fs.writeFileSync('src/syncWeb.mjs', content);
}
