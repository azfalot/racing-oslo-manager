import axios from 'axios';

/**
 * Obtiene y analiza la información de todos los equipos rivales de la liga
 * @param {ComunioClient} client Cliente de comunio autenticado
 * @returns {Promise<Array>}
 */
export async function analyzeRivals(client) {
  const rivalsData = [];
  try {
    const headers = client.getHeaders();
    const url = `https://api.comunio.es/communities/${client.communityId}/members`;
    const response = await axios.get(url, { headers });
    
    const members = response.data.members || [];
    
    for (const m of members) {
      // Ignorar al propio usuario en la lista de rivales para enfocar el análisis en los demás,
      // o incluirlo para comparar. Vamos a incluir a todos para poder hacer una comparativa completa.
      try {
        const squadUrl = `https://api.comunio.es/users/${m.id}/squad`;
        const squadRes = await axios.get(squadUrl, { headers });
        const players = squadRes.data.items || [];
        
        let totalValue = 0;
        players.forEach(p => {
          totalValue += p.quotedprice || 0;
        });

        // Ordenar estrellas
        const sortedStars = [...players]
          .sort((a, b) => (b.quotedprice || 0) - (a.quotedprice || 0))
          .slice(0, 3)
          .map(p => ({
            name: p.name,
            position: p.position,
            price: p.quotedprice || 0
          }));

        rivalsData.push({
          userId: m.id,
          teamName: m.firstName,
          ownerName: m.login,
          playerCount: players.length,
          squadValue: totalValue,
          stars: sortedStars,
          isMe: parseInt(m.id) === parseInt(client.userId)
        });
      } catch (e) {
        // Ignorar fallos individuales de descarga de plantilla
      }
    }
  } catch (err) {
    console.warn('[RIVALS] No se pudo realizar el análisis de rivales:', err.message);
  }

  // Ordenar rivales por valor de plantilla de mayor a menor
  return rivalsData.sort((a, b) => b.squadValue - a.squadValue);
}
