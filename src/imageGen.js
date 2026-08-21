import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Descarga y asegura la foto oficial del jugador vía API de Comunio
 */
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

/**
 * Generador Maestro de Tarjetas Gráficas de Noticias
 * Soporta 4 Plantillas Oficiales: 'signing' (Compra), 'sale' (Venta), 'medical' (Enfermería), 'rumors' (Rumores)
 * Superpone en la esquina superior derecha la foto circular del jugador descargada de la API.
 * Para ventas ('sale'), superpone además la insignia del comprador (Comunio C o equipo rival).
 * La plantilla se mantiene impoluta sin bloques de texto artificiales pegados.
 */
export async function generateTemplateGraphic(type, playerName, subText = '', playerId = null, buyerName = 'Computadora') {
  try {
    const templateFilename = `template_${type}.jpg`;
    const bgPath = path.resolve(`web/public/media/templates/${templateFilename}`);
    
    // Directorio de salida en la web pública
    const outDirWeb = path.resolve('web/public/media/news_graphics');
    if (!fs.existsSync(outDirWeb)) {
      fs.mkdirSync(outDirWeb, { recursive: true });
    }

    const outputFileName = `${type}_${playerId || Date.now()}.jpg`;
    const outPathWeb = path.resolve(outDirWeb, outputFileName);
    const webRelativeUrl = `/media/news_graphics/${outputFileName}`;

    if (!fs.existsSync(bgPath)) {
      console.warn(`[IMAGE GEN] Plantilla base ${templateFilename} no encontrada en ${bgPath}.`);
      return '/media/crest.jpg';
    }

    const bgImage = await loadImage(bgPath);
    const width = bgImage.width;
    const height = bgImage.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dibujar plantilla de fondo oficial
    ctx.drawImage(bgImage, 0, 0, width, height);

    // 2. Descargar y superponer la foto circular del jugador en la esquina superior derecha
    if (playerId) {
      await ensurePlayerPhoto(playerId);
      const photoPath = path.resolve(`web/public/media/players/${playerId}.png`);
      
      if (fs.existsSync(photoPath)) {
        try {
          const playerImg = await loadImage(photoPath);

          // Coordenadas de precisión del círculo superior derecho (86.5% ancho, 20.5% alto)
          const cx = width * 0.865;
          const cy = height * 0.205;
          const radius = width * 0.082;

          ctx.save();
          
          // Recorte circular
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();

          // Fondo oscuro detrás de la foto
          ctx.fillStyle = '#1b382b';
          ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

          // Dibujar la foto del jugador dentro del círculo
          ctx.drawImage(playerImg, cx - radius, cy - radius, radius * 2, radius * 2);
          ctx.restore();

          // Anillo / Borde verde de acabado profesional
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#2d5a42';
          ctx.stroke();

          // Anillo crema fino interior
          ctx.beginPath();
          ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#e8e0cc';
          ctx.stroke();
        } catch (imgErr) {
          console.warn(`[IMAGE GEN] Error montando foto circular para ${playerName}:`, imgErr.message);
        }
      }
    }

    // 3. Para Ventas ('sale'): Superponer insignia/logo del equipo comprador (Comunio C si es Computadora)
    if (type === 'sale') {
      const isComputer = !buyerName || buyerName.toLowerCase().includes('computer') || buyerName.toLowerCase().includes('computadora');
      
      const bx = width * 0.71;
      const by = height * 0.205;
      const bradius = width * 0.055;

      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, bradius, 0, Math.PI * 2);
      ctx.fillStyle = '#1b382b';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e8e0cc';
      ctx.stroke();

      if (isComputer) {
        // Logo oficial de Comunio ("C")
        ctx.font = `bold ${Math.round(bradius * 1.2)}px sans-serif`;
        ctx.fillStyle = '#40805c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('C', bx, by);
      } else {
        // Iniciales del comprador rival
        ctx.font = `bold ${Math.round(bradius * 0.7)}px sans-serif`;
        ctx.fillStyle = '#e8e0cc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = buyerName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
        ctx.fillText(initials, bx, by);
      }
      ctx.restore();
    }

    // Guardar archivo compilado
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    fs.writeFileSync(outPathWeb, buffer);
    console.log(`[IMAGE GEN] Tarjeta gráfica oficial (${type}) generada: ${webRelativeUrl}`);
    return webRelativeUrl;

  } catch (err) {
    console.error(`[IMAGE GEN ERROR] Error al generar gráfica para ${type}:`, err.message);
    return '/media/crest.jpg';
  }
}

// ── MÓDULOS DE PUBLICACIÓN DE NOTICIAS CON PLANTILLAS UNIFICADAS ─────────────

export async function publishSigningNews(playerName, price, playerId, position = 'Jugador') {
  try {
    const formattedPrice = typeof price === 'number' ? price.toLocaleString() + ' €' : price;
    
    // Generar gráfica oficial con la plantilla de Compra + Foto API
    const graphicUrl = await generateTemplateGraphic('signing', playerName, formattedPrice, playerId);

    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
      const signingArticle = {
        id: `signing_${playerId}_${Date.now()}`,
        title: `¡Oficial! ${playerName} ficha por el Racing de Oslo`,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        category: 'Fichajes',
        excerpt: `El club hace oficial la incorporación de ${playerName} tras abonar su traspaso por ${formattedPrice}.`,
        summary: `El club hace oficial la incorporación de ${playerName} tras abonar su traspaso por ${formattedPrice}.`,
        content: `Mateo Oslomany ha cerrado otra operación estelar. ${playerName} se une a las filas del Racing de Oslo por ${formattedPrice}.\n\nLa dirección deportiva confía en su gran aportación y calidad para afrontar la temporada con máximas garantías.\n\n¡Bienvenido al club, ${playerName}!`,
        image: graphicUrl
      };

      newsList.unshift(signingArticle);
      fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
      console.log(`[NEWS] Noticia oficial de fichaje publicada para ${playerName}.`);
      return signingArticle;
    }
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando noticia de fichaje:', e.message);
  }
  return null;
}

export async function publishSaleNews(playerName, price, playerId, buyerName = 'Computadora') {
  try {
    const formattedPrice = typeof price === 'number' ? price.toLocaleString() + ' €' : price;

    // Generar gráfica oficial con la plantilla de Venta (misma que signing) + Foto API + Logo comprador
    const graphicUrl = await generateTemplateGraphic('sale', playerName, formattedPrice, playerId, buyerName);

    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
      const saleArticle = {
        id: `sale_${playerId}_${Date.now()}`,
        title: `¡Oficial! ${playerName} abandona el Racing de Oslo`,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        category: 'Ventas',
        excerpt: `El club hace oficial la salida de ${playerName} a ${buyerName} tras alcanzar un acuerdo por su traspaso por ${formattedPrice}.`,
        summary: `El club hace oficial la salida de ${playerName} a ${buyerName} tras alcanzar un acuerdo por su traspaso por ${formattedPrice}.`,
        content: `La dirección deportiva encabezada por Mateo Oslomany ha cerrado la operación de traspaso de ${playerName} a ${buyerName} por un importe total de ${formattedPrice}.\n\nDesde el Racing de Oslo agradecemos su profesionalidad y dedicación defendiendo nuestra camiseta en el Oslo Arena, y le deseamos los mayores éxitos en sus futuros proyectos profesionales.\n\n¡Gracias por todo y mucha suerte, ${playerName}!`,
        image: graphicUrl
      };

      newsList.unshift(saleArticle);
      fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
      console.log(`[NEWS] Noticia oficial de venta publicada para ${playerName}.`);
      return saleArticle;
    }
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando noticia de venta:', e.message);
  }
  return null;
}

export async function publishMedicalNews(playerName, statusDetails, playerId) {
  try {
    // Generar gráfica oficial con la plantilla de Enfermería + Foto API
    const graphicUrl = await generateTemplateGraphic('medical', playerName, statusDetails, playerId);

    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
      const medicalArticle = {
        id: `medical_${playerId}_${Date.now()}`,
        title: `Parte Médico & Estado: ${playerName}`,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        category: 'Enfermería',
        excerpt: `El cuerpo médico emite el informe de evolución física y disponibilidad de ${playerName}.`,
        summary: `El cuerpo médico emite el informe de evolución física y disponibilidad de ${playerName}.`,
        content: `Los servicios médicos del Racing de Oslo informan sobre la situación de ${playerName}: ${statusDetails}.\n\nEl cuerpo técnico liderado por Mateo Oslomany evalúa su evolución día a día priorizando la salud y el máximo rendimiento del jugador de cara a las próximas jornadas.`,
        image: graphicUrl
      };

      newsList.unshift(medicalArticle);
      fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
      console.log(`[NEWS] Noticia médica oficial publicada para ${playerName}.`);
      return medicalArticle;
    }
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando parte médico:', e.message);
  }
  return null;
}

export async function publishRumorNews(playerName, rumorDetails, playerId = null) {
  try {
    // Generar gráfica oficial con la plantilla de Rumores (Mateo Oslomany en despacho) + Foto API
    const graphicUrl = await generateTemplateGraphic('rumors', playerName, rumorDetails, playerId);

    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
      const rumorArticle = {
        id: `rumor_${playerId || Date.now()}_${Date.now()}`,
        title: `Rumores de Mercado: Racing de Oslo interesado en ${playerName}`,
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        category: 'Rumores',
        excerpt: `Mateo Oslomany trabaja activamente en el mercado buscando reforzar el equipo con ${playerName}.`,
        summary: `Mateo Oslomany trabaja activamente en el mercado buscando reforzar el equipo con ${playerName}.`,
        content: `Las negociaciones de mercado se intensifican en las oficinas del Oslo Arena. Mateo Oslomany rastrea minuciosamente la situación de ${playerName} (${rumorDetails}).\n\nLa Dirección Deportiva continúa valorando perfiles estratégicos para elevar la competitividad de la plantilla.`,
        image: graphicUrl
      };

      newsList.unshift(rumorArticle);
      fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
      console.log(`[NEWS] Noticia de rumores publicada para ${playerName}.`);
      return rumorArticle;
    }
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando rumor:', e.message);
  }
  return null;
}

// Helpers retrocompatibles
export async function generateSigningPhoto(playerName, playerPrice, playerId, positionName = 'JUGADOR', isSale = false) {
  return generateTemplateGraphic(isSale ? 'sale' : 'signing', playerName, playerPrice, playerId);
}

export async function generateSalePhoto(playerName, playerPrice, playerId, positionName = 'JUGADOR') {
  return generateTemplateGraphic('sale', playerName, playerPrice, playerId);
}
