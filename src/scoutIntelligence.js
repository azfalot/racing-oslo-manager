/**
 * Módulo de Inteligencia de Scouting & Probabilidad de Titularidad Online
 * 
 * Rastrea en tiempo real noticias de prensa deportiva (FútbolFantasy, JornadaPerfecta, Marca, As, etc.)
 * sobre posibles alineaciones, rotaciones europeas, dudas de última hora y declaraciones de entrenadores.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = 'last_scouting_cache.json';

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {}
}

/**
 * Realiza scouting online para un jugador y calcula su probabilidad real de titularidad
 * @param {string} playerName Nombre del futbolista
 * @param {string} clubName Club de LaLiga
 * @returns {Promise<{ playerName: string, club: string, starterProbability: number, statusTag: string, statusEmoji: string, headlines: Array, alerts: Array, summary: string }>}
 */
export async function getOnlineScoutingReport(playerName, clubName = '') {
  const cleanName = (playerName || '').trim();
  const cacheKey = cleanName.toLowerCase();
  const cache = loadCache();

  // Cache válida por 2 horas
  const cached = cache[cacheKey];
  if (cached && (Date.now() - (cached.timestamp || 0)) < 2 * 60 * 60 * 1000) {
    return cached.data;
  }

  const headlines = [];
  const alerts = [];
  let starterProbability = 80; // Base para jugadores de Primera División
  let statusTag = 'TITULAR_PROBABLE';
  let statusEmoji = '🟢';

  try {
    // 1. Consulta RSS a Google News España especializada en Fútbol / Fantasy
    const query = encodeURIComponent(`"${cleanName}" (${clubName || 'LaLiga'}) (alineacion OR titular OR lesion OR once OR comunio OR fantasy)`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=es&gl=ES&ceid=ES:es`;

    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    const itemMatches = res.data.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (const rawItem of itemMatches.slice(0, 6)) {
      const titleMatch = rawItem.match(/<title>([\s\S]*?)<\/title>/);
      const pubDateMatch = rawItem.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = rawItem.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const linkMatch = rawItem.match(/<link>([\s\S]*?)<\/link>/);

      if (titleMatch) {
        let cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&');
        headlines.push({
          title: cleanTitle,
          source: sourceMatch ? sourceMatch[1] : 'Prensa Deportiva',
          date: pubDateMatch ? pubDateMatch[1] : '',
          link: linkMatch ? linkMatch[1] : ''
        });
      }
    }

    // 2. Procesamiento semántico de titulares de prensa
    const corpus = headlines.map(h => h.title.toLowerCase()).join(' ');

    if (corpus.includes('baja') || corpus.includes('lesionad') || corpus.includes('rotura') || corpus.includes('operad') || corpus.includes('sancionad') || corpus.includes('roja')) {
      starterProbability = 0;
      statusTag = 'BAJA_CONFIRMADA';
      statusEmoji = '🔴';
      alerts.push('🚨 Prensa reporta baja confirmada o lesión importante.');
    } else if (corpus.includes('duda') || corpus.includes('molestias') || corpus.includes('al margen') || corpus.includes('tocad') || corpus.includes('no entrena')) {
      starterProbability = 35;
      statusTag = 'DUDA_MEDICA';
      statusEmoji = '🟡';
      alerts.push('⚠️ Molestias o entrenamientos al margen detectados en prensa.');
    } else if (corpus.includes('banquillo') || corpus.includes('suplente') || corpus.includes('rotacion') || corpus.includes('descanso') || corpus.includes('champions')) {
      starterProbability = 45;
      statusTag = 'ROTACION_PREVISTA';
      statusEmoji = '🔄';
      alerts.push('🔄 Posible rotación o descanso por carga de partidos.');
    } else if (corpus.includes('titular') || corpus.includes('once probable') || corpus.includes('alineacion probable') || corpus.includes('fijo') || corpus.includes('once tipo')) {
      starterProbability = 95;
      statusTag = 'TITULAR_CONFIRMADO';
      statusEmoji = '⭐';
      alerts.push('✅ Señalado como titular en las previas de alineaciones probables.');
    } else {
      starterProbability = 80;
      statusTag = 'DISPONIBLE_REGULAR';
      statusEmoji = '🟢';
      alerts.push('🟢 Dinámica habitual de disponibilidad sin alertas negativas.');
    }

  } catch (err) {
    console.warn(`[SCOUTING WARNING] No se pudieron obtener noticias para ${cleanName}:`, err.message);
  }

  const report = {
    playerName: cleanName,
    club: clubName,
    starterProbability,
    statusTag,
    statusEmoji,
    headlines,
    alerts,
    summary: `Probabilidad de titularidad estimada en ${starterProbability}% según scouting online.`,
    scoutedAt: new Date().toISOString()
  };

  // Guardar en cache
  cache[cacheKey] = {
    timestamp: Date.now(),
    data: report
  };
  saveCache(cache);

  return report;
}
