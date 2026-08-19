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

    if (mvMatch) {
      return {
        value: mvMatch[1].trim(),
        url: profileUrl
      };
    }
  } catch (err) {
    // Falla de red o de parseo silenciosa para no interrumpir el flujo principal
  }
  return null;
}
