import axios from 'axios';
import { generateTemplateGraphic, publishClubNews } from './imageGen.js';
import { ComunioClient } from './comunioClient.js';

const PUBLIC_BASE_URL = 'https://racing-oslo.cotero91.workers.dev';

/**
 * Publica una noticia oficial directamente en el tablón de Comunio vía API directa con HTML e imágenes
 */
export async function publishPostToComunioApi(title, htmlMessage, options = {}) {
  const client = options.client || new ComunioClient();
  let mustClose = false;
  if (!client.isLoggedIn) {
    await client.login();
    mustClose = true;
  }

  console.log(`[COMUNIO-POSTER] 📢 Publicando comunicado en Comunio: "${title}"...`);

  try {
    const url = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/news`;
    const payload = {
      newsEntry: {
        newsId: `notSaved@${Date.now()}`,
        date: new Date().toISOString(),
        owner: {
          id: client.userId,
          name: 'Racing de Oslo'
        },
        iconType: 'USER_POST',
        comments: [],
        title: title.slice(0, 255),
        message: {
          text: htmlMessage
        },
        type: 'OTHER',
        recipientId: null,
        poll: null
      }
    };

    const res = await axios.post(url, payload, { headers: client.getHeaders() });
    if (res.status === 200 || res.status === 201) {
      console.log(`[COMUNIO-POSTER] 🚀 ¡Post publicado en Comunio con éxito! NewsID: ${res.data?.newsId || 'OK'}`);
      if (mustClose) await client.close();
      return true;
    }
  } catch (err) {
    console.error('[COMUNIO-POSTER ERROR] Error al publicar en Comunio API:', err.response?.data || err.message);
  }

  if (mustClose) await client.close();
  return false;
}

/**
 * PUNTO 1: Publica el lanzamiento de la Sede Digital con enlace e imagen oficial
 */
export async function postPortalLaunchAnnouncement() {
  const title = '🏛️ COMUNICADO OFICIAL: Sede Digital del Racing de Oslo';
  const imgPath = '/media/news_graphics/club_sede_digital_oficial.jpg';
  const fullImgUrl = `${PUBLIC_BASE_URL}${imgPath}`;

  // 1. Generar tarjeta gráfica oficial
  await generateTemplateGraphic('club', 'SEDE DIGITAL OFICIAL', 'Portal Web Oficial y Sala de Prensa');

  // 2. Formato HTML para el tablón oficial de Comunio
  const htmlMessage = 
    '<p>La Junta Directiva del <strong>Racing de Oslo</strong> pone a disposición de toda la comunidad el portal interactivo oficial del club.<br><br>' +
    '📊 <strong>CONTENIDO EN ABIERTO:</strong><br>' +
    ' • <strong>Plantilla en tiempo real:</strong> cotizaciones, roles tácticos y actas oficiales.<br>' +
    ' • <strong>Crónicas & Pronósticos:</strong> auditorías de puntos por jornada y previas.<br>' +
    ' • <strong>Economía de la Liga:</strong> gráfica comparativa de valor de todos los clubes.<br><br>' +
    `🌐 <strong>ACCESO AL PORTAL:</strong> <a title="Sede Digital Racing de Oslo" href="${PUBLIC_BASE_URL}/" target="_blank" rel="noopener">racing-oslo.cotero91.workers.dev</a><br><br>` +
    `<img src="${fullImgUrl}" alt="Sede Digital Racing de Oslo" width="1024" height="682"><br><br>` +
    '<em>¡Bienvenidos al Oslo Arena!</em></p>';

  return publishPostToComunioApi(title, htmlMessage);
}

/**
 * PUNTO 2: Publica un Comunicado Oficial tras un Fichaje Bomba / Galáctico
 */
export async function postStarSigningAnnouncement(playerName, priceFormatted, playerId = null, position = 'centrocampista') {
  const title = `⭐ COMUNICADO OFICIAL: ${playerName} nuevo jugador del Racing de Oslo`;
  
  // 1. Generar tarjeta gráfica oficial de fichaje
  const graphicRelPath = await generateTemplateGraphic('signing', playerName, priceFormatted, playerId);
  const fullImgUrl = `${PUBLIC_BASE_URL}${graphicRelPath}`;

  // 2. Formato HTML para Comunio
  const htmlMessage = 
    `<p>El <strong>Racing de Oslo</strong> y la Secretaría Técnica liderada por Mateo Oslomany han cerrado con éxito la incorporación de <strong>${playerName}</strong>.<br><br>` +
    `💼 <strong>DETALLES DE LA OPERACIÓN:</strong><br>` +
    ` • <strong>Futbolista:</strong> ${playerName} (${position})<br>` +
    ` • <strong>Inversión acordada:</strong> ${priceFormatted}<br><br>` +
    `El jugador queda inscrito de inmediato para afrontar el próximo choque liguero en el Oslo Arena.<br><br>` +
    `📰 <strong>Ficha técnica y perfil del jugador en:</strong> <a title="Portal Oficial" href="${PUBLIC_BASE_URL}/" target="_blank" rel="noopener">racing-oslo.cotero91.workers.dev</a><br><br>` +
    `<img src="${fullImgUrl}" alt="${playerName}" width="1024" height="682"></p>`;

  return publishPostToComunioApi(title, htmlMessage);
}

/**
 * PUNTO 3: Publica diariamente a las 18:00 el informe táctico y de scouting 360º de la comunidad
 */
export async function postDailyRivalesAuditAnnouncement() {
  const title = '📊 INFORME TÁCTICO & SCOUTING 360º: Radiografía de la Comunidad';
  const imgPath = '/media/news_graphics/club_sede_digital_oficial.jpg';
  const fullImgUrl = `${PUBLIC_BASE_URL}${imgPath}`;

  // 1. Generar tarjeta gráfica oficial
  await generateTemplateGraphic('club', 'SCOUTING & AUDITORÍA 360º', 'Radiografía Táctica de la Liga');

  // 2. Formato HTML para el tablón oficial de Comunio
  const htmlMessage = 
    '<p>La Dirección Deportiva del <strong>Racing de Oslo</strong> publica la actualización de la <strong>Auditoría Táctica y Scouting 360º</strong> para todos los clubes de la liga.<br><br>' +
    '🔍 <strong>SERVICIOS EN ABIERTO EN LA SEDE DIGITAL:</strong><br>' +
    ' • <strong>Radiografía por Clubes:</strong> Pizarra del 11 titular estimado de cada rival y techo de puntos.<br>' +
    ' • <strong>Salud Financiera & Deuda:</strong> Semáforo de solvencia y apalancamiento.<br>' +
    ' • <strong>Asistencia IA de Fichajes:</strong> Recomendaciones de mercado según carencias tácticas.<br>' +
    ' • <strong>Mercado en Vivo:</strong> Listado actualizado de oportunidades.<br><br>' +
    `🌐 <strong>CONSULTAR EL INFORME COMPLETO DE TU CLUB:</strong> <a title="Auditoría de Rivales" href="${PUBLIC_BASE_URL}/rivales" target="_blank" rel="noopener">racing-oslo.cotero91.workers.dev/rivales</a><br><br>` +
    `<img src="${fullImgUrl}" alt="Auditoría 360 de Rivales" width="1024" height="682"><br><br>` +
    '<em>Secretaría Técnica · Racing de Oslo</em></p>';

  return publishPostToComunioApi(title, htmlMessage);
}
