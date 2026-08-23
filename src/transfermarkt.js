import axios from 'axios';

/**
 * Busca a un jugador en Transfermarkt.es y obtiene su valor de mercado real
 * @param {string} playerName Nombre del jugador
 * @returns {Promise<{value: string, url: string} | null>}
 */
export async function getTransfermarktData(playerName) {
  try {
    const searchUrl = `https://www.transfermarkt.es/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(playerName)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      timeout: 5000
    });

    // Encontrar el enlace del perfil
    const match = response.data.match(/\/[-a-zA-Z0-9_]+\/profil\/spieler\/[0-9]+/);
    if (!match) return null;

    const profileUrl = `https://www.transfermarkt.es${match[0]}`;

    // Obtener la página del perfil
    const profileRes = await axios.get(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      timeout: 5000
    });

    // Extraer valor de mercado usando regexes robustos
    const mvMatch = profileRes.data.match(/class="data-header__market-value-wrapper">[\s\S]*?>[\s]*([0-9,]+\s*(mill\.|mil)\s*€)/i) ||
                    profileRes.data.match(/tm-player-market-value-development__current-value">[\s]*([0-9,]+\s*(mill\.|mil)\s*€)/i) ||
                    profileRes.data.match(/([0-9,]+\s*(mill\.|mil)\s*€)/i);

    // Extraer edad (ej: itemprop="birthDate" ... (32))
    const ageMatch = profileRes.data.match(/itemprop="birthDate"[^>]*>[\s\S]*?\(([0-9]{2})\)/i) ||
                     profileRes.data.match(/Edad:[\s\S]*?\(([0-9]{2})\)/i) ||
                     profileRes.data.match(/Fec\. nacim\.\/Edad:[\s\S]*?\(([0-9]{2})\)/i) ||
                     profileRes.data.match(/([0-9]{2})\s*años/i);

    // Extraer pie hábil
    const footMatch = profileRes.data.match(/Pie:[\s\S]*?info-table__content--bold">[\s]*([a-zA-Záéíóúñ]+)/i) ||
                      profileRes.data.match(/pie\s*(izquierdo|diestro|ambidiestro)/i);

    // Extraer posición detallada
    const posMatch = profileRes.data.match(/Posición principal:[\s\S]*?info-table__content--bold">[\s]*([a-zA-Záéíóúñ\s-]+)/i) ||
                     profileRes.data.match(/data-header__label">Posición:[\s\S]*?<span class="data-header__content">[\s]*([a-zA-Záéíóúñ\s-]+)/i);

    const valueStr = mvMatch ? mvMatch[1].trim() : 'Sin cotización';
    const ageStr = ageMatch ? `${ageMatch[1].trim()} años` : null;
    const footStr = footMatch ? footMatch[1].trim() : null;
    const posStr = posMatch ? posMatch[1].trim() : null;

    return {
      value: valueStr,
      age: ageStr,
      foot: footStr,
      detailedPosition: posStr,
      url: profileUrl
    };
  } catch (err) {
    // Falla silenciosa para no interrumpir el flujo principal
  }
  return null;
}
