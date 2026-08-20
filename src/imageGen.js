import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

export async function generateSigningPhoto(playerName, playerPrice, playerId, positionName = 'JUGADOR', isSale = false) {
  try {
    const bgPath = path.resolve('web/public/media/signing_template.jpg');
    const photoPath = path.resolve(`web/public/media/players/${playerId}.png`);
    const outDir = path.resolve('web/public/media/signings');
    const outPath = path.resolve(outDir, `${playerId}_${isSale ? 'sale' : 'signing'}.jpg`);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const bgImage = await loadImage(bgPath);
    const width = bgImage.width;
    const height = bgImage.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    ctx.drawImage(bgImage, 0, 0, width, height);

    // 2. Draw Header text at top center
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '500 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💼 Mateo Oslomany · Director Deportivo · Racing de Oslo · Est. 2018', width / 2, 35);
    ctx.restore();

    // 3. Draw Player Circular Avatar (Top Right)
    if (fs.existsSync(photoPath)) {
      ctx.save();
      const avatarX = width - 180;
      const avatarY = 160;
      const avatarRadius = 110;

      // Outer Green Ring Border
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2);
      ctx.fillStyle = '#1e3e2b'; // Club dark green
      ctx.fill();

      // Inner White Ring
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Circular Clip
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.clip();

      // Background inside avatar
      ctx.fillStyle = '#2c4c38';
      ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);

      // Draw Player Image
      const playerImg = await loadImage(photoPath);
      ctx.drawImage(playerImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();
    }

    // 4. Draw Player Name & Position Overlay (Left Side)
    ctx.save();
    const nameParts = playerName.trim().split(' ');
    const firstName = nameParts.length > 1 ? nameParts[0].toUpperCase() : '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ').toUpperCase() : nameParts[0].toUpperCase();

    let textY = height - 260;

    // Green badge for First Name / Prefix
    if (firstName) {
      ctx.font = 'bold 24px sans-serif';
      const badgeWidth = ctx.measureText(firstName).width + 24;
      ctx.fillStyle = '#1e3e2b';
      ctx.fillRect(40, textY - 30, badgeWidth, 36);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(firstName, 52, textY - 5);
      textY += 45;
    }

    // Last Name (Big Bold White)
    ctx.font = '900 64px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText(lastName, 40, textY);
    ctx.shadowBlur = 0;

    // Position Subtitle
    ctx.font = '600 20px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText((positionName || 'JUGADOR').toUpperCase(), 42, textY + 35);
    ctx.restore();

    // 5. Draw Bottom Banner (Cream Background)
    const bannerHeight = 90;
    const bannerY = height - bannerHeight;

    ctx.save();
    ctx.fillStyle = '#eae5d8'; // Cream color matching reference
    ctx.fillRect(0, bannerY, width, bannerHeight);

    // Format Price
    let priceStr = '0 €';
    if (typeof playerPrice === 'number') {
      if (playerPrice >= 1000000) {
        priceStr = (playerPrice / 1000000).toFixed(1) + 'M €';
      } else {
        priceStr = (playerPrice / 1000).toFixed(0) + 'K €';
      }
    }

    // Left Column: INVERSIÓN / VENTA
    ctx.fillStyle = '#1e3e2b';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(isSale ? 'VENTA' : 'INVERSIÓN', 40, bannerY + 32);

    ctx.font = '900 36px sans-serif';
    ctx.fillText(priceStr, 40, bannerY + 70);

    // Right Column: NUEVO FICHAJE / SALIDA -> RACING DE OSLO
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(isSale ? 'SALIDA CONFIRMADA' : 'NUEVO FICHAJE', width - 40, bannerY + 32);

    ctx.font = '900 28px sans-serif';
    ctx.fillText('RACING DE OSLO', width - 40, bannerY + 68);

    ctx.restore();

    // Save to file
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    fs.writeFileSync(outPath, buffer);
    return outPath;
  } catch (e) {
    console.error('[CANVAS IMAGE GEN] Error:', e);
    return null;
  }
}

export async function ensurePlayerPhoto(playerId) {
  if (!playerId) return '/media/crest.jpg';
  const dir = path.resolve('web/public/media/players');
  const localPath = path.resolve(dir, `${playerId}.png`);
  
  if (fs.existsSync(localPath)) {
    return `/media/players/${playerId}.png`;
  }

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const url = `https://api.comunio.es/players/${playerId}/photo`;
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(localPath, response.data);
    console.log(`[API PHOTO] Foto del jugador ID ${playerId} descargada con éxito.`);
    return `/media/players/${playerId}.png`;
  } catch (err) {
    console.warn(`[API PHOTO] No se pudo descargar la foto del jugador ID ${playerId}:`, err.message);
    return '/media/crest.jpg';
  }
}

export async function generateSalePhoto(playerName, playerPrice, playerId, positionName = 'JUGADOR') {
  return generateSigningPhoto(playerName, playerPrice, playerId, positionName, true);
}

export async function publishSaleNews(playerName, price, playerId) {
  try {
    const formattedPrice = typeof price === 'number' ? price.toLocaleString() + ' €' : price;
    const numericPrice = typeof price === 'number' ? price : parseInt(price.replace(/[^0-9]/g, '')) || 0;
    
    // 1. Generar tarjeta gráfica oficial de venta
    const photoPath = await generateSalePhoto(playerName, formattedPrice, playerId);
    
    // 2. Asegurar foto oficial del jugador vía API de Comunio
    await ensurePlayerPhoto(playerId);

    // 3. Publicar noticia en news.json con formato IDÉNTICO a las compras
    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
      const imageToUse = fs.existsSync(path.resolve(`web/public/media/signings/${playerId}_sale.jpg`)) 
        ? `/media/signings/${playerId}_sale.jpg` 
        : (fs.existsSync(path.resolve(`web/public/media/players/${playerId}.png`)) ? `/media/players/${playerId}.png` : '/media/crest.jpg');

      const saleArticle = {
        id: `sale_${playerId}_${Date.now()}`,
        title: `¡Oficial! ${playerName} abandona el Racing de Oslo`,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        category: 'Ventas',
        excerpt: `El club hace oficial la salida de ${playerName} tras alcanzar un acuerdo por su traspaso por ${formattedPrice}.`,
        summary: `El club hace oficial la salida de ${playerName} tras alcanzar un acuerdo por su traspaso por ${formattedPrice}.`,
        content: `La dirección deportiva encabezada por Mateo Oslomany ha cerrado la operación de traspaso de ${playerName} por un importe total de ${formattedPrice}.\n\nDesde el Racing de Oslo agradecemos su profesionalidad y dedicación defendiendo nuestra camiseta en el Oslo Arena, y le deseamos los mayores éxitos en sus futuros proyectos profesionales.\n\n¡Gracias por todo y mucha suerte, ${playerName}!`,
        image: imageToUse
      };

      newsList.unshift(saleArticle);
      fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
      console.log(`[NEWS] Noticia oficial de venta publicada para ${playerName} (${formattedPrice}).`);
      return saleArticle;
    }
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando noticia de venta:', e.message);
  }
  return null;
}

export async function publishSigningNews(playerName, price, playerId) {
  try {
    const formattedPrice = typeof price === 'number' ? price.toLocaleString() + ' €' : price;
    
    // 1. Generar tarjeta gráfica oficial de fichaje
    await generateSigningPhoto(playerName, formattedPrice, playerId);
    
    // 2. Asegurar foto oficial del jugador vía API de Comunio
    await ensurePlayerPhoto(playerId);

    // 3. Publicar noticia en news.json
    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
      const imageToUse = fs.existsSync(path.resolve(`web/public/media/signings/${playerId}_signing.jpg`)) 
        ? `/media/signings/${playerId}_signing.jpg` 
        : (fs.existsSync(path.resolve(`web/public/media/players/${playerId}.png`)) ? `/media/players/${playerId}.png` : '/media/crest.jpg');

      const signingArticle = {
        id: `signing_${playerId}_${Date.now()}`,
        title: `¡Oficial! ${playerName} ficha por el Racing de Oslo`,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        category: 'Fichajes',
        excerpt: `El club hace oficial la incorporación de ${playerName} tras abonar su traspaso por ${formattedPrice}.`,
        summary: `El club hace oficial la incorporación de ${playerName} tras abonar su traspaso por ${formattedPrice}.`,
        content: `Mateo Oslomany ha cerrado otra operación estelar. ${playerName} se une a las filas del Racing de Oslo por ${formattedPrice}.\n\nLa dirección deportiva confía en su gran aportación y calidad para afrontar la temporada con máximas garantías.\n\n¡Bienvenido al club, ${playerName}!`,
        image: imageToUse
      };

      newsList.unshift(signingArticle);
      fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
      console.log(`[NEWS] Noticia oficial de fichaje publicada para ${playerName} (${formattedPrice}).`);
      return signingArticle;
    }
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando noticia de fichaje:', e.message);
  }
  return null;
}
