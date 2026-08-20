import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

export async function generateSigningPhoto(playerName, playerPrice, playerId) {
  try {
    const bgPath = path.resolve('web/public/media/signing_template.jpg');
    const photoPath = path.resolve(`web/public/media/players/${playerId}.png`);
    const outPath = path.resolve(`web/public/media/signings/${playerId}_signing.jpg`);

    if (!fs.existsSync('web/public/media/signings')) {
      fs.mkdirSync('web/public/media/signings', { recursive: true });
    }

    const bg = await Jimp.read(bgPath);
    bg.resize({ w: 1200, h: 800 });

    if (fs.existsSync(photoPath)) {
      const playerImg = await Jimp.read(photoPath);
      playerImg.resize({ w: 400, h: 400 });
      bg.composite(playerImg, 400, 100);
    }

    await bg.write(outPath);
    return outPath;
  } catch (e) {
    console.error('[IMAGE GEN] Error:', e.message || e);
    return null;
  }
}
