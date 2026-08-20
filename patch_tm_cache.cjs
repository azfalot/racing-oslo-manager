const fs = require('fs');
let content = fs.readFileSync('src/transfermarkt.js', 'utf8');

if (!content.includes('const cacheFile')) {
  const cacheLogic = `
import fs from 'fs';
const cacheFile = 'tm_cache.json';

function getCache() {
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}
`;
  
  content = content.replace("import * as cheerio from 'cheerio';", "import * as cheerio from 'cheerio';\n" + cacheLogic);
  
  const functionStart = "export async function getTransfermarktData(playerName) {\n  try {";
  const injectCacheCheck = `
  const cache = getCache();
  if (cache[playerName] && (Date.now() - cache[playerName].timestamp < 86400000)) {
    return cache[playerName].data;
  }
`;
  content = content.replace(functionStart, functionStart + injectCacheCheck);
  
  const functionEnd = "return { value: numericValue, url: profileUrl };";
  const injectSaveCache = `
    const result = { value: numericValue, url: profileUrl };
    cache[playerName] = { timestamp: Date.now(), data: result };
    saveCache(cache);
    return result;
`;
  content = content.replace(functionEnd, injectSaveCache);

  fs.writeFileSync('src/transfermarkt.js', content);
}
