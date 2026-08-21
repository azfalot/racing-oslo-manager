import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

async function testOverlay() {
  const bgPath = path.resolve('web/public/media/templates/template_signing.jpg');
  const bgImage = await loadImage(bgPath);
  const width = bgImage.width; // 1024
  const height = bgImage.height; // 686

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bgImage, 0, 0, width, height);

  // Let's test covering the old name/price region if needed or drawing text over it
  // In typical templates, the text area is in the lower half or middle-left:
  // e.g. x: 50..600, y: 400..600
  
  // Let's draw a patch rectangle to cover existing static text if present
  // Box for Name & Subtext
  // Background patch matching dark green/forest theme of template
  const patchX = width * 0.05;
  const patchY = height * 0.58;
  const patchW = width * 0.70;
  const patchH = height * 0.32;

  // Save canvas with patch box to test coordinates
  ctx.save();
  ctx.fillStyle = '#0f2318'; // Dark forest background color
  ctx.fillRect(patchX, patchY, patchW, patchH);

  // Border line
  ctx.strokeStyle = '#2d5a42';
  ctx.lineWidth = 3;
  ctx.strokeRect(patchX, patchY, patchW, patchH);

  // Draw Player Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ADRIÁN DE LA FUENTE', patchX + 25, patchY + 65);

  // Draw Subtext / Price
  ctx.fillStyle = '#a8c49a';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('3.910.000 €', patchX + 25, patchY + 120);

  ctx.restore();

  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync('scratch/test_out.jpg', buffer);
  console.log('Saved scratch/test_out.jpg');
}

testOverlay().catch(console.error);
