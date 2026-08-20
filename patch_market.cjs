const fs = require('fs');

let content = fs.readFileSync('src/syncWeb.mjs', 'utf8');

const marketCode = `
  // Market
  const rawMarket = await client.getMarket();
  const marketJson = rawMarket.players.map(p => ({
    id: p.playerId,
    name: p.name,
    price: p.price,
    position: p.type,
    points: p.totalPoints,
    owner: p.owner.name,
    ownerId: p.owner.id,
    image: \`https://api.comunio.es/players/\${p.playerId}/photo?size=l&cropped=1\`
  }));
  
  for(const p of marketJson) {
    const photoUrl = p.image;
    p.image = \`/media/players/\${p.id}.png\`;
    if(!fs.existsSync(\`./web/public/media/players/\${p.id}.png\`)) {
      try {
        const res = await axios.get(photoUrl, { headers: client.getHeaders(), responseType: 'arraybuffer' });
        fs.writeFileSync(\`./web/public/media/players/\${p.id}.png\`, res.data);
      } catch(e) {}
    }
  }
  
  fs.writeFileSync('./web/src/data/market.json', JSON.stringify(marketJson, null, 2));
`;

content = content.replace('// Matches', marketCode + '\n  // Matches');

fs.writeFileSync('src/syncWeb.mjs', content);
