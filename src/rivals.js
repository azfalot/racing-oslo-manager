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

/**
 * Analiza las noticias de transacciones recientes en Comunio para calcular
 * los márgenes de sobrepuja históricos de cada manager rival (Inteligencia de Pujas).
 */
export async function getRivalBiddingIntelligence(client) {
  const intel = {
    rivalProfiles: {},
    highThreatPositions: { keeper: false, defender: false, midfielder: false, striker: false },
    avgCommunityOverbid: 15.0
  };

  try {
    const fs = await import('fs');
    const path = await import('path');
    const txPath = path.resolve('web/src/data/historicalTransactions.json');
    let transactions = [];

    if (fs.existsSync(txPath)) {
      transactions = JSON.parse(fs.readFileSync(txPath, 'utf8'));
    }

    if (transactions.length === 0 && client) {
      const url = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/news?start=0&limit=50`;
      const response = await axios.get(url, { headers: client.getHeaders() });
      const entries = response.data?.newsList?.entries || [];
      // parse fallback
    }

    let totalOverbidSum = 0;
    let validTxCount = 0;

    for (const tx of transactions) {
      const buyer = tx.buyer;
      const pricePaid = tx.price || 0;
      if (!buyer || buyer.toLowerCase() === 'computer' || pricePaid <= 0) continue;

      if (!intel.rivalProfiles[buyer]) {
        intel.rivalProfiles[buyer] = {
          name: buyer,
          totalPurchases: 0,
          totalSpent: 0,
          maxSpent: 0,
          overbidCount: 0,
          aggressiveLevel: 'Normal',
          avgOverbidPct: 0
        };
      }

      intel.rivalProfiles[buyer].totalPurchases += 1;
      intel.rivalProfiles[buyer].totalSpent += pricePaid;
      if (pricePaid > intel.rivalProfiles[buyer].maxSpent) {
        intel.rivalProfiles[buyer].maxSpent = pricePaid;
      }
      if (tx.isOverbid) {
        intel.rivalProfiles[buyer].overbidCount += 1;
      }

      if (pricePaid >= 15000000 || intel.rivalProfiles[buyer].totalSpent >= 50000000) {
        intel.rivalProfiles[buyer].aggressiveLevel = 'Alto (Tiburón de Mercado)';
      } else if (pricePaid >= 5000000) {
        intel.rivalProfiles[buyer].aggressiveLevel = 'Moderado (Pujas Selectivas)';
      }

      totalOverbidSum += (tx.diffPct || 0);
      validTxCount++;
    }

    if (validTxCount > 0) {
      intel.avgCommunityOverbid = parseFloat((totalOverbidSum / validTxCount).toFixed(1));
    }
  } catch (err) {
    console.warn('[RIVALS INTEL] Error calculando inteligencia de pujas:', err.message);
  }

  return intel;
}
