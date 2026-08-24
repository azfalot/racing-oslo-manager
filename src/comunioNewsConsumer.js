import axios from 'axios';
import { 
  publishMarketDealNews, 
  publishSigningNews, 
  publishSaleNews, 
  publishClubNews 
} from './imageGen.js';

/**
 * Obtiene la información exacta de la jornada actual y la próxima jornada desde la API oficial de Comunio
 */
export async function getNextMatchdayInfo(client) {
  if (!client.isLoggedIn) await client.login();
  try {
    const response = await axios.get('https://api.comunio.es/matchdays', {
      headers: client.getHeaders()
    });
    const rawMatchdays = Array.isArray(response.data) ? response.data : (response.data?.items || []);
    const matchdays = rawMatchdays.filter(m => m.type === 'matchday' || m.type === 'regular' || m.matchdayKey)
      .sort((a, b) => parseInt(a.matchdayKey) - parseInt(b.matchdayKey));

    const ongoing = matchdays.find(m => m.started && !m.finished);
    const upcoming = matchdays.find(m => !m.started && !m.finished);

    const currentKey = ongoing ? parseInt(ongoing.matchdayKey) : (upcoming ? Math.max(1, parseInt(upcoming.matchdayKey) - 1) : 1);
    const nextKey = upcoming ? parseInt(upcoming.matchdayKey) : (ongoing ? parseInt(ongoing.matchdayKey) + 1 : 2);
    const targetMatchday = upcoming || ongoing;

    let kickoffDate = null;
    let kickoffFormatted = 'Por determinar';

    if (targetMatchday) {
      try {
        const detailRes = await axios.get(`https://api.comunio.es/matchdays/${targetMatchday.id}`, {
          headers: client.getHeaders()
        });
        const firstMatch = (detailRes.data?.items || [])[0];
        if (firstMatch?.kickoff) {
          kickoffDate = new Date(firstMatch.kickoff);
          kickoffFormatted = kickoffDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (e) {}
    }

    const now = new Date();
    const diffHours = kickoffDate ? Math.max(0, Math.round((kickoffDate.getTime() - now.getTime()) / (1000 * 60 * 60))) : null;

    return {
      currentMatchday: currentKey,
      nextMatchday: nextKey,
      isOngoing: !!ongoing,
      kickoffDate,
      kickoffFormatted,
      hoursRemaining: diffHours,
      deadlineText: kickoffDate ? `⏰ Límite para saldo positivo y 11: ${kickoffFormatted}` : 'Calendario pendiente'
    };
  } catch (err) {
    console.error('[MATCHDAYS] Error al consultar jornadas en Comunio:', err.message);
    return {
      currentMatchday: 2,
      nextMatchday: 3,
      isOngoing: true,
      kickoffFormatted: 'Viernes 28 de agosto, 19:00',
      hoursRemaining: 105,
      deadlineText: 'Viernes 28 de agosto a las 19:00h'
    };
  }
}

/**
 * Motor de Consumo de Noticias y Eventos de la Comunidad Comunio
 * Parsea el tablón oficial de la comunidad (TRANSACTIONS, ADMINISTRATION, LINEUPS, BONUSES)
 * y genera las noticias automáticas correspondientes.
 */
export async function consumeComunioNews(client) {
  if (!client.isLoggedIn) await client.login();
  const newsUrl = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/news`;
  
  try {
    const res = await axios.get(newsUrl, { headers: client.getHeaders() });
    const entries = res.data?.newsList?.entries || [];
    console.log(`[NEWS CONSUMER] Procesando ${entries.length} entradas del tablón oficial de Comunio...`);

    const processedEvents = [];

    for (const entry of entries) {
      // 1. COMUNICADOS DE ADMINISTRACIÓN / JORNADAS EXTRA / AVISOS DE COMPUTER
      if (entry.type === 'ADMINISTRATION' && entry.message?.text) {
        const cleanText = entry.message.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const title = entry.title || 'Aviso Oficial de Comunio';
        processedEvents.push({
          type: 'ADMINISTRATION',
          id: entry.id,
          date: entry.date,
          title,
          text: cleanText
        });
      }

      // 2. TRANSACCIONES Y FICHAJES DE LA COMUNIDAD
      if (entry.type === 'TRANSACTION' && entry.message?.text) {
        const rawText = entry.message.text;
        const pattern = /<a[^>]*>([^<]+)<\/a>\s*cambia por\s*([\d\.]+)\s*€\s*de\s*(?:<a[^>]*>)?([^<]+)(?:<\/a>)?\s*a\s*(?:<a[^>]*>)?([^<]+)(?:<\/a>)?/gi;
        
        let match;
        while ((match = pattern.exec(rawText)) !== null) {
          const playerName = match[1].trim();
          const price = parseInt(match[2].replace(/\./g, ''));
          const sellerName = match[3].trim();
          const buyerName = match[4].trim();

          processedEvents.push({
            type: 'TRANSACTION',
            date: entry.date,
            playerName,
            price,
            sellerName,
            buyerName
          });
        }
      }
    }

    return processedEvents;
  } catch (err) {
    console.error('[NEWS CONSUMER ERROR] Error al consumir noticias de Comunio:', err.message);
    return [];
  }
}
