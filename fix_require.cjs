const fs = require('fs');
let c = fs.readFileSync('src/comunioClient.js', 'utf8');
c = c.replace("const { chromium } = require('playwright');", "");
fs.writeFileSync('src/comunioClient.js', c);
