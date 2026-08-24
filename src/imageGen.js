import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { exec } from 'child_process';

let syncDebounceTimeout = null;
export function triggerWebSync() {
  if (syncDebounceTimeout) clearTimeout(syncDebounceTimeout);
  syncDebounceTimeout = setTimeout(() => {
    console.log('[NEWS] Desencadenando sincronización web automática tras publicación...');
    exec('node src/syncWeb.mjs', (err) => {
      if (err) console.error('[NEWS ERROR] Error en syncWeb automático:', err.message);
      else console.log('[NEWS] Sincronización y despliegue a Cloudflare completado tras nuevo evento.');
    });
  }, 4000);
}

export function insertOrUpdateNews(article) {
  const newsPath = path.resolve('web/src/data/news.json');
  let newsList = [];
  if (fs.existsSync(newsPath)) {
    try {
      newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
    } catch (e) {
      newsList = [];
    }
  }

  // Deduplicación estricta por ID base, título o par jugador-categoría
  const cleanList = newsList.filter(n => {
    if (n.id === article.id) return false;
    if (n.title.trim().toLowerCase() === article.title.trim().toLowerCase()) return false;
    if (article.category === n.category && article.id && n.id) {
      const artBase = article.id.split('_').slice(0, 2).join('_');
      const curBase = n.id.split('_').slice(0, 2).join('_');
      if (artBase === curBase) return false;
    }
    return true;
  });

  cleanList.unshift(article);
  const finalList = cleanList.slice(0, 25);
  fs.writeFileSync(newsPath, JSON.stringify(finalList, null, 2));
  console.log(`[NEWS] Noticia guardada y deduplicada con éxito: "${article.title}"`);
  
  triggerWebSync();
  return article;
}

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
 * Soporta todas las plantillas oficiales:
 * 'signing', 'sale', 'market', 'finance', 'mvp', 'medical', 'rumors', 'preview', 'chronicle', 'club', 'analysis'
 */
export async function generateTemplateGraphic(type, playerName, subText = '', playerId = null, extraData = {}) {
  try {
    let templateFilename = `template_${type}.jpg`;
    let bgPath = path.resolve(`web/public/media/templates/${templateFilename}`);
    
    // Fallbacks si no existe
    if (!fs.existsSync(bgPath)) {
      if (type === 'market' || type === 'rival') bgPath = path.resolve('web/public/media/templates/template_market.jpg');
      else if (type === 'finance') bgPath = path.resolve('web/public/media/templates/template_finance.jpg');
      else if (type === 'mvp') bgPath = path.resolve('web/public/media/templates/template_mvp.jpg');
      else bgPath = path.resolve('web/public/media/templates/template_club.jpg');
    }

    const outDirWeb = path.resolve('web/public/media/news_graphics');
    if (!fs.existsSync(outDirWeb)) {
      fs.mkdirSync(outDirWeb, { recursive: true });
    }

    const outputFileName = `${type}_${playerId || (playerName ? playerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : Date.now())}.jpg`;
    const outPathWeb = path.resolve(outDirWeb, outputFileName);
    const webRelativeUrl = `/media/news_graphics/${outputFileName}`;

    const bgImage = await loadImage(bgPath);
    const width = bgImage.width;
    const height = bgImage.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dibujar plantilla base
    ctx.drawImage(bgImage, 0, 0, width, height);

    // 2. Renderizado especializado por tipo de plantilla
    if (type === 'market' || type === 'rival') {
      // ── PLANTILLA MERCADO DE FICHAJES (RIVALES Y PROPIOS) ──
      // Foto en caja izquierda (x: 25, y: 145, w: 220, h: 250)
      if (playerId) {
        await ensurePlayerPhoto(playerId);
        const photoPath = path.resolve(`web/public/media/players/${playerId}.png`);
        if (fs.existsSync(photoPath)) {
          const playerImg = await loadImage(photoPath);
          ctx.drawImage(playerImg, 35, 155, 200, 235);
        }
      }

      // Nombre del jugador
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText((playerName || 'JUGADOR').toUpperCase(), 260, 205);

      // Posición
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText((extraData.position || extraData.type || 'FUTBOLISTA').toUpperCase(), 260, 245);

      // Metadatos (Edad, Nacionalidad, Club)
      ctx.fillStyle = '#d4ceb8';
      ctx.font = '13px sans-serif';
      ctx.fillText(extraData.age || '-- años', 285, 305);
      ctx.fillText(extraData.nationality || 'España', 385, 305);
      ctx.fillText(extraData.prevClub || extraData.club || 'LaLiga', 505, 305);

      // Comentarios de la secretaría
      if (extraData.comments || subText) {
        ctx.fillStyle = '#a3a092';
        ctx.font = 'italic 12px sans-serif';
        const cText = (extraData.comments || subText).slice(0, 50);
        ctx.fillText(cText, 260, 360);
      }

      // Rival
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText((extraData.buyerName || extraData.rival || 'RIVAL').toUpperCase(), 725, 140);

      // Precio
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 22px monospace';
      const pStr = typeof extraData.price === 'number' ? extraData.price.toLocaleString() + ' €' : (extraData.price || subText || '-- €');
      ctx.fillText(pStr, 860, 285);

      // Tipo de Operación
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.fillText(extraData.opType || 'Traspaso Oficial', 880, 355);

      // Fecha
      ctx.fillStyle = '#d4ceb8';
      ctx.font = '14px monospace';
      ctx.fillText(extraData.date || new Date().toLocaleDateString('es-ES'), 890, 425);

    } else if (type === 'finance') {
      // ── PLANTILLA INFORME FINANCIERO ──
      const netWorth = extraData.netWorth || 61075340;
      const debt = extraData.debt || 0;
      const wageBill = extraData.wageBill || 14200000;
      const spendingCap = extraData.spendingCap || 45000000;
      const balance = extraData.balance || 19765340;
      const teamValue = extraData.teamValue || 41310000;

      // Resumen Ejecutivo (arriba a la derecha)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${netWorth.toLocaleString()} €`, 870, 95);
      
      ctx.fillStyle = '#86efac';
      ctx.fillText(debt === 0 ? '0 € (SANEADA)' : `${debt.toLocaleString()} €`, 870, 140);

      ctx.fillStyle = '#d4ceb8';
      ctx.fillText(`${wageBill.toLocaleString()} €`, 870, 185);
      ctx.fillText(`${spendingCap.toLocaleString()} €`, 870, 230);

      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 17px monospace';
      ctx.fillText(`${balance.toLocaleString()} €`, 870, 275);

      // Balance General (Valores en Activos)
      ctx.fillStyle = '#d4ceb8';
      ctx.font = '13px monospace';
      ctx.fillText(`${balance.toLocaleString()} €`, 140, 420);
      ctx.fillText(`${teamValue.toLocaleString()} €`, 140, 510);
      ctx.fillText(`${netWorth.toLocaleString()} €`, 130, 615);
      ctx.fillText(debt === 0 ? '0 €' : `${debt.toLocaleString()} €`, 370, 615);

      // Gauge de Masa Salarial
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('31.5%', 70, 518);

    } else if (type === 'mvp') {
      // ── PLANTILLA MVP DE LA JORNADA ──
      // Foto central
      if (playerId) {
        await ensurePlayerPhoto(playerId);
        const photoPath = path.resolve(`web/public/media/players/${playerId}.png`);
        if (fs.existsSync(photoPath)) {
          const playerImg = await loadImage(photoPath);
          ctx.drawImage(playerImg, 420, 150, 190, 240);
        }
      }

      // Dorsal y Nombre
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(`#${extraData.dorsal || '10'}`, 680, 115);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText((playerName || 'JUGADOR').toUpperCase(), 760, 115);

      // Posición y Jornada
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText((extraData.position || 'DELANTERO').toUpperCase(), 860, 335);

      ctx.fillStyle = '#d4ceb8';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(extraData.matchday || 'Jornada 2', 860, 420);

      // Métricas (Puntos, Goles, Asistencias)
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`${extraData.points || subText || 14} PTS`, 670, 610);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`${extraData.goals || 1}`, 745, 610);
      ctx.fillText(`${extraData.assists || 1}`, 815, 610);
      ctx.fillText(`${extraData.shots || 4}`, 875, 610);
      ctx.fillText(`${extraData.keyPasses || 3}`, 935, 610);

    } else {
      // ── PLANTILLAS CLÁSICAS (signing, sale, medical, rumors, preview, chronicle, club, analysis) ──
      if (playerId) {
        await ensurePlayerPhoto(playerId);
        const photoPath = path.resolve(`web/public/media/players/${playerId}.png`);
        
        if (fs.existsSync(photoPath)) {
          const playerImg = await loadImage(photoPath);
          const cx = width * 0.865;
          const cy = height * 0.205;
          const radius = width * 0.082;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();

          ctx.fillStyle = '#1b382b';
          ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
          ctx.drawImage(playerImg, cx - radius, cy - radius, radius * 2, radius * 2);
          ctx.restore();

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#2d5a42';
          ctx.stroke();
        }
      }

      // En ventas ('sale'), superponer comprador
      if (type === 'sale' && extraData.buyerName) {
        const cx = width * 0.865;
        const cy = height * 0.44;
        const badgeRadius = width * 0.045;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = '#0f291e';
        ctx.fillRect(cx - badgeRadius, cy - badgeRadius, badgeRadius * 2, badgeRadius * 2);

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(extraData.buyerName.slice(0, 8), cx, cy);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#d4af37';
        ctx.stroke();
      }
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

// ── MÓDULOS DE PUBLICACIÓN DE NOTICIAS ────────────────────────────────────────

export async function publishSigningNews(playerName, price, playerId, position = 'Jugador') {
  try {
    const formattedPrice = typeof price === 'number' ? price.toLocaleString() + ' €' : price;
    const graphicUrl = await generateTemplateGraphic('signing', playerName, formattedPrice, playerId);

    const signingArticle = {
      id: `signing_${playerId}`,
      title: `¡Oficial! ${playerName} ficha por el Racing de Oslo`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Fichajes',
      excerpt: `El club hace oficial la incorporación de ${playerName} tras abonar su traspaso por ${formattedPrice}.`,
      summary: `El club hace oficial la incorporación de ${playerName} tras abonar su traspaso por ${formattedPrice}.`,
      content: `Mateo Oslomany ha cerrado otra operación estelar. ${playerName} se une a las filas del Racing de Oslo por ${formattedPrice}.\n\nLa dirección deportiva confía en su gran aportación y calidad para afrontar la temporada con máximas garantías.\n\n¡Bienvenido al club, ${playerName}!`,
      image: graphicUrl,
      author: 'Mateo Oslomany'
    };

    return insertOrUpdateNews(signingArticle);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando noticia de fichaje:', e.message);
  }
  return null;
}

export async function publishSaleNews(playerName, price, playerId, buyerName = 'Computadora') {
  try {
    const formattedPrice = typeof price === 'number' ? price.toLocaleString() + ' €' : price;
    const graphicUrl = await generateTemplateGraphic('sale', playerName, formattedPrice, playerId, { buyerName });

    const saleArticle = {
      id: `sale_${playerId}`,
      title: `¡Oficial! ${playerName} abandona el Racing de Oslo`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Ventas',
      excerpt: `El club hace oficial la salida de ${playerName} a ${buyerName} tras alcanzar un acuerdo por su traspaso por ${formattedPrice}.`,
      summary: `El club hace oficial la salida de ${playerName} a ${buyerName} tras alcanzar un acuerdo por su traspaso por ${formattedPrice}.`,
      content: `La dirección deportiva encabezada por Mateo Oslomany ha cerrado la operación de traspaso de ${playerName} a ${buyerName} por un importe total de ${formattedPrice}.\n\nDesde el Racing de Oslo agradecemos su profesionalidad y dedicación defendiendo nuestra camiseta en el Oslo Arena, y le deseamos los mayores éxitos en sus futuros proyectos profesionales.\n\n¡Gracias por todo y mucha suerte, ${playerName}!`,
      image: graphicUrl,
      author: 'Mateo Oslomany'
    };

    return insertOrUpdateNews(saleArticle);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando noticia de venta:', e.message);
  }
  return null;
}

export async function publishMarketDealNews(data) {
  try {
    const graphicUrl = await generateTemplateGraphic('market', data.playerName, data.price, data.playerId, data);
    const article = {
      id: `market_deal_${data.playerId || data.playerName.replace(/\s+/g, '_')}`,
      title: `MERCADO: ${data.buyerName} ficha a ${data.playerName} por ${typeof data.price === 'number' ? data.price.toLocaleString() + ' €' : data.price}`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Rivales',
      excerpt: `${data.buyerName} completa la incorporación de ${data.playerName} procedente de ${data.prevClub || 'LaLiga'}.`,
      summary: `${data.buyerName} completa la incorporación de ${data.playerName} procedente de ${data.prevClub || 'LaLiga'}.`,
      content: `Movimiento de mercado confirmado en la comunidad. ${data.buyerName} se ha hecho con los servicios de ${data.playerName} tras una puja de ${typeof data.price === 'number' ? data.price.toLocaleString() + ' €' : data.price}.\n\nEl Racing de Oslo audita los movimientos de los rivales mientras mantiene una sólida posición de liquidez.`,
      image: graphicUrl,
      author: 'Fabrizio Oslomano'
    };
    return insertOrUpdateNews(article);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando fichaje de mercado:', e.message);
  }
}

export async function publishFinancialReportNews(data) {
  try {
    const graphicUrl = await generateTemplateGraphic('finance', 'Informe Financiero', '', null, data);
    const article = {
      id: `finance_report_${new Date().toISOString().slice(0, 10)}`,
      title: 'COMUNICADO INSTITUCIONAL: Balance Financiero y Techo de Gasto del Racing de Oslo',
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Finanzas',
      excerpt: `Cuentas 100% saneadas con ${(data.balance || 19765340).toLocaleString()} € de saldo disponible y patrimonio neto de ${(data.netWorth || 61075340).toLocaleString()} €.`,
      summary: `Cuentas 100% saneadas con ${(data.balance || 19765340).toLocaleString()} € de saldo disponible y patrimonio neto de ${(data.netWorth || 61075340).toLocaleString()} €.`,
      content: `La Dirección Deportiva y el Departamento Financiero del Racing de Oslo presentan el balance económico oficial:\n\n💰 Saldo Disponible en Caja: ${(data.balance || 19765340).toLocaleString()} €\n🛡️ Valor de Plantilla: ${(data.teamValue || 41310000).toLocaleString()} €\n🏦 Patrimonio Neto: ${(data.netWorth || 61075340).toLocaleString()} €\n📊 Deuda Total: 0 € (Club 100% Saneado)\n\nEl Racing de Oslo mantiene una posición financiera privilegiada para afrontar las grandes operaciones del mercado.`,
      image: graphicUrl,
      author: 'Mateo Oslomany'
    };
    return insertOrUpdateNews(article);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando informe financiero:', e.message);
  }
}

export async function publishMvpNews(data) {
  try {
    const graphicUrl = await generateTemplateGraphic('mvp', data.playerName, `${data.points} pts`, data.playerId, data);
    const article = {
      id: `mvp_${data.playerId}_${data.matchday || 'jornada'}`,
      title: `⭐ MVP DE LA JORNADA: ${data.playerName} corona una actuación estelar con ${data.points} puntos`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'MVP',
      excerpt: `${data.playerName} es elegido mejor jugador del Racing de Oslo en la ${data.matchday || 'jornada'}.`,
      summary: `${data.playerName} es elegido mejor jugador del Racing de Oslo en la ${data.matchday || 'jornada'}.`,
      content: `Actuación colosal de ${data.playerName}. El futbolista del Racing de Oslo firma ${data.points} puntos en Comunio con ${data.goals || 1} gol(es) y ${data.assists || 1} asistencia(s).\n\n"Su talento decide partidos, su coraje construye historia." — Mateo Oslomany.`,
      image: graphicUrl,
      author: 'Julio Osldini'
    };
    return insertOrUpdateNews(article);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando MVP:', e.message);
  }
}

export async function publishMedicalNews(playerName, statusDetails, playerId) {
  try {
    const graphicUrl = await generateTemplateGraphic('medical', playerName, statusDetails, playerId);

    const medicalArticle = {
      id: `medical_${playerId}`,
      title: `Parte Médico & Estado: ${playerName}`,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Enfermería',
      excerpt: `El cuerpo médico emite el informe de evolución física y disponibilidad de ${playerName}.`,
      summary: `El cuerpo médico emite el informe de evolución física y disponibilidad de ${playerName}.`,
      content: `Los servicios médicos del Racing de Oslo informan sobre la situación de ${playerName}: ${statusDetails}.\n\nEl cuerpo técnico liderado por Mateo Oslomany evalúa su evolución día a día priorizando la salud y el máximo rendimiento del jugador de cara a las próximas jornadas.`,
      image: graphicUrl,
      author: 'Mateo Oslomany'
    };

    return insertOrUpdateNews(medicalArticle);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando parte médico:', e.message);
  }
  return null;
}

export async function publishRumorNews(playerName, rumorDetails, playerId = null, isEntry = true) {
  try {
    const graphicUrl = await generateTemplateGraphic('rumors', playerName, rumorDetails, playerId);
    const titleStr = isEntry
      ? `RUMOR: El Racing de Oslo interesado en el fichaje de ${playerName}`
      : `RUMOR: El Racing de Oslo escucha ofertas por ${playerName}`;
    
    const rumorArticle = {
      id: `rumor_${playerId || playerName.toLowerCase().replace(/\s+/g, '_')}`,
      title: titleStr,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Rumores',
      excerpt: `Mateo Oslomany evalúa el mercado de fichajes sobre la situación de ${playerName}.`,
      summary: `Mateo Oslomany evalúa el mercado de fichajes sobre la situación de ${playerName}.`,
      content: `Las oficinas del Oslo Arena se mantienen en plena actividad. Mateo Oslomany y la Secretaría Técnica valoran la operación con ${playerName} (${rumorDetails}).\n\nEl club continúa analizando las opciones financieras y deportivas para mantener una plantilla de máximas garantías.`,
      image: graphicUrl,
      author: 'Fabrizio Oslomano'
    };

    return insertOrUpdateNews(rumorArticle);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando rumor:', e.message);
  }
  return null;
}

export async function publishClubNews(title, summary, bodyText, category = 'Institucional', templateType = 'club') {
  try {
    const graphicUrl = await generateTemplateGraphic(templateType, title, summary);
    const article = {
      id: `club_${category.toLowerCase()}_${title.slice(0, 15).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      title: title,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: category,
      excerpt: summary,
      summary: summary,
      content: bodyText,
      image: graphicUrl || '/media/templates/template_club.jpg'
    };

    return insertOrUpdateNews(article);
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando comunicado del club:', e.message);
  }
  return null;
}

export async function publishMatchdayPreviewNews(matchdayName, starting11Names, formation, expectedPoints) {
  try {
    const title = `ONCE CONFIRMADO: Mateo Oslomany anuncia la alineación para la ${matchdayName}`;
    const summary = `El Racing de Oslo presenta su dibujo táctico (${formation}) con ~${expectedPoints} pts esperados.`;
    const bodyText = `Mateo Oslomany ha confirmado el 11 Titular oficial para afrontar el próximo compromiso de la ${matchdayName}:\n\n` +
      `📐 Formación: ${formation}\n` +
      `🎯 Puntuación esperada: ~${expectedPoints} pts\n\n` +
      `⬛ Titulares elegidos:\n` + starting11Names.map(n => ` • ${n}`).join('\n') + `\n\n` +
      `¡Todo listo en el vestuario para salir a competir al máximo nivel!`;

    return await publishClubNews(title, summary, bodyText, 'Previa', 'preview');
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando previa de jornada:', e.message);
  }
  return null;
}

export async function publishMatchdayChronicleNews(matchdayName, totalPoints, highlights) {
  try {
    const title = `CRÓNICA DE JORNADA: El Racing de Oslo suma ${totalPoints} puntos en la ${matchdayName}`;
    const summary = `Resumen post-partido y actuaciones destacadas de la plantilla en el último choque liguero.`;
    const bodyText = `Finalizada la ${matchdayName}, el Racing de Oslo firma un balance total de ${totalPoints} puntos.\n\n` +
      `⭐ Destacados de la jornada:\n${highlights}\n\n` +
      `La dirección técnica saca conclusiones positivas y comienza a preparar el siguiente choque de LaLiga.`;

    return await publishClubNews(title, summary, bodyText, 'Crónica', 'chronicle');
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando crónica de jornada:', e.message);
  }
  return null;
}

export async function publishTacticalAnalysisNews(summary, details) {
  try {
    const title = `ANÁLISIS TÁCTICO & MERCADO: Mateo Oslomany evalúa el estado del club`;
    const bodyText = `La Secretaría Técnica ha completado el informe de auditoría integral del club:\n\n${details}`;

    return await publishClubNews(title, summary, bodyText, 'Táctica', 'analysis');
  } catch (e) {
    console.error('[NEWS ERROR] Error publicando análisis táctico:', e.message);
  }
  return null;
}

export async function generateSigningPhoto(playerName, playerPrice, playerId, positionName = 'JUGADOR', isSale = false) {
  return generateTemplateGraphic(isSale ? 'sale' : 'signing', playerName, playerPrice, playerId);
}

export async function generateSalePhoto(playerName, playerPrice, playerId, positionName = 'JUGADOR') {
  return generateTemplateGraphic('sale', playerName, playerPrice, playerId);
}
