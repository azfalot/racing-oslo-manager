import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

async function ensurePlayerPhoto(playerId) {
  const photoPath = path.resolve(`web/public/media/players/${playerId}.png`);
  if (!fs.existsSync(photoPath)) {
    try {
      const parentDir = path.dirname(photoPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      const url = `https://api.comunio.es/players/${playerId}/photo?size=l&cropped=1`;
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      fs.writeFileSync(photoPath, res.data);
    } catch (e) {
      console.warn(`[IMAGE GEN] Could not download photo for player ${playerId}:`, e.message);
    }
  }
  return photoPath;
}

export async function generateSigningPhoto(playerName, playerPrice, playerId) {
  try {
    const bgPath = path.resolve('web/public/media/signing_template.jpg');
    const photoPath = await ensurePlayerPhoto(playerId);
    const outDir = path.resolve('web/public/media/signings');
    const outPath = path.resolve(outDir, `${playerId}_signing.jpg`);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
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
    console.error('[IMAGE GEN - FICHAJE] Error:', e.message || e);
    return null;
  }
}

export async function generateSalePhoto(playerName, playerPrice, playerId) {
  try {
    const bgPath = path.resolve('web/public/media/signing_template.jpg');
    const photoPath = await ensurePlayerPhoto(playerId);
    const outDir = path.resolve('web/public/media/signings');
    const outPath = path.resolve(outDir, `${playerId}_sale.jpg`);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
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
    console.error('[IMAGE GEN - VENTA] Error:', e.message || e);
    return null;
  }
}
