const fs = require('fs');

let c = fs.readFileSync('src/app.js', 'utf8');

if (!c.includes('acceptBestOffers()')) {
  const injectAccept = `
    // Aceptar ofertas rentables pendientes
    console.log('[INFO] Revisando y aceptando ofertas de venta...');
    await client.acceptBestOffers();
  `;
  
  c = c.replace("const pendingBids = await client.getPendingBids();", "const pendingBids = await client.getPendingBids();\n" + injectAccept);
  fs.writeFileSync('src/app.js', c);
}
