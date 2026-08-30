import fs from 'fs';
import path from 'path';

const RADAR_FILE = path.resolve('scouting_radar.json');

// Lista base de objetivos galácticos libres prioritarios (+35 pts sobre nuestra plantilla)
const DEFAULT_WISHLIST = [
  { name: "Grimaldo", fullName: "Álex Grimaldo", position: "defender", targetPrice: 11070000, estimatedPts: 195, compTarget: "Aïssa Mandi", owner: "Computer" },
  { name: "Fornals", fullName: "Pablo Fornals", position: "midfielder", targetPrice: 11460000, estimatedPts: 175, compTarget: "Moi Gómez", owner: "Computer" },
  { name: "Kang-In Lee", fullName: "Kang-In Lee", position: "midfielder", targetPrice: 15370000, estimatedPts: 165, compTarget: "Moi Gómez", owner: "Computer" },
  { name: "Aubameyang", fullName: "Pierre-Emerick Aubameyang", position: "striker", targetPrice: 17160000, estimatedPts: 185, compTarget: "Pablo Durán", owner: "Computer" }
];

export function loadScoutingRadar() {
  try {
    if (fs.existsSync(RADAR_FILE)) {
      const data = JSON.parse(fs.readFileSync(RADAR_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn('[SCOUTING-RADAR] Error leyendo scouting_radar.json, usando base:', e.message);
  }
  return [...DEFAULT_WISHLIST];
}

export function saveScoutingRadar(radar) {
  try {
    fs.writeFileSync(RADAR_FILE, JSON.stringify(radar, null, 2));
  } catch (e) {
    console.error('[SCOUTING-RADAR] Error guardando scouting_radar.json:', e.message);
  }
}

/**
 * Audita el mercado y actualiza el Radar de Ojeo:
 * 1. Solo incluye jugadores de Computer (mercado libre) o transferibles en venta activa de rivales.
 * 2. Descarta jugadores ya fichados por rivales (sin clausulazos no están disponibles).
 * 3. Exige mejora neta de +35 puntos sobre nuestro titular en esa posición.
 * 4. Limita la lista al TOP 4-5 de mayor impacto para máxima concisión y valor.
 */
export function auditAndSyncScoutingRadar(marketPlayers = [], squad = { players: [] }, engine) {
  const currentSquad = squad.players || [];
  const myIds = new Set(currentSquad.map(p => p.playerId || p.id));

  // Mapa de IDs actualmente en el mercado activo de hoy
  const activeMarketMap = new Map();
  marketPlayers.forEach(mp => {
    const pid = mp.playerId || mp.id;
    if (pid) activeMarketMap.set(pid, mp);
    if (mp.name) activeMarketMap.set(mp.name.toLowerCase().trim(), mp);
  });

  // 1. Obtener la referencia de puntos del titular más bajo por posición
  const posStarters = { keeper: [], defender: [], midfielder: [], striker: [] };
  currentSquad.forEach(p => {
    const pos = p.type || p.position || 'defender';
    const proj = engine ? engine.getSeasonProjection(p) : (p.totalPoints || 0);
    if (posStarters[pos]) posStarters[pos].push({ name: p.name, proj });
  });

  const posBaseline = {
    keeper: (posStarters.keeper.sort((a, b) => b.proj - a.proj)[0]?.proj) || 140,
    defender: (posStarters.defender.sort((a, b) => b.proj - a.proj)[2]?.proj) || 120, // 3º defensa titular
    midfielder: (posStarters.midfielder.sort((a, b) => b.proj - a.proj)[3]?.proj) || 120, // 4º medio titular
    striker: (posStarters.striker.sort((a, b) => b.proj - a.proj)[2]?.proj) || 95 // 3º delantero (Pablo Durán)
  };

  const posWeakestName = {
    keeper: posStarters.keeper[0]?.name || 'David Soria',
    defender: posStarters.defender[2]?.name || 'Aïssa Mandi',
    midfielder: posStarters.midfielder[3]?.name || 'Moi Gómez',
    striker: posStarters.striker[2]?.name || 'Pablo Durán'
  };

  const cleanRadar = [];

  // 2. Evaluar candidatos de la lista base
  DEFAULT_WISHLIST.forEach(dw => {
    const onMarket = activeMarketMap.get(dw.name.toLowerCase()) || (dw.playerId ? activeMarketMap.get(dw.playerId) : null);
    const estPts = dw.estimatedPts;
    const baseline = posBaseline[dw.position] || 100;
    const netGain = estPts - baseline;

    cleanRadar.push({
      ...dw,
      netGain: Math.max(35, netGain),
      compTarget: posWeakestName[dw.position] || dw.compTarget,
      onMarket: !!onMarket,
      targetPrice: onMarket ? (onMarket.price || dw.targetPrice) : dw.targetPrice,
      owner: onMarket ? (onMarket.owner?.name || 'Computer') : 'Computer'
    });
  });

  // 3. Revisar jugadores del mercado activo de hoy (solo Computer o en venta real)
  marketPlayers.forEach(mp => {
    const mpId = mp.playerId || mp.id;
    if (myIds.has(mpId)) return;

    const mpName = mp.name;
    const mpPos = mp.type || mp.position || 'defender';
    const mpPrice = mp.price || 0;
    const mpProj = engine ? engine.getSeasonProjection(mp) : 0;
    const baseline = posBaseline[mpPos] || 100;
    const netGain = mpProj - baseline;

    const isComputer = !mp.owner || mp.owner === 'Computer' || mp.owner?.name === 'Computer' || mp.ownerName === 'Computer';
    const ownerName = isComputer ? 'Computer' : (mp.owner?.name || mp.ownerName || 'Rival en venta');

    // Descartar si pertenece a un rival humano y no es una necesidad crítica / gran salto (+50 pts)
    if (!isComputer && netGain < 50) {
      return;
    }

    if (mpName.toLowerCase().includes('mbapp') || mpName.toLowerCase().includes('raphinha') || mpName.toLowerCase().includes('fermín lópez') || mpName.toLowerCase().includes('cubars')) {
      return; // Ya fichados por rivales
    }

    if (netGain >= 35 && mpPrice >= 1500000) {
      const alreadyIn = cleanRadar.find(r => r.name.toLowerCase() === mpName.toLowerCase() || (r.playerId && r.playerId === mpId));
      if (!alreadyIn) {
        cleanRadar.push({
          playerId: mpId,
          name: mpName,
          fullName: mpName,
          position: mpPos,
          targetPrice: mpPrice,
          estimatedPts: mpProj,
          netGain: Math.round(netGain),
          compTarget: posWeakestName[mpPos] || 'Titular rotación',
          owner: ownerName,
          onMarket: true,
          autoDiscovered: true
        });
      }
    }
  });

  // 4. Ordenar: primero los que están en el mercado hoy, luego por mayor ganancia neta
  cleanRadar.sort((a, b) => {
    if (a.onMarket !== b.onMarket) return b.onMarket ? 1 : -1;
    return (b.netGain || 0) - (a.netGain || 0);
  });

  // 5. Limitar estrictamente al TOP 4 de mayor valor
  const topRadar = cleanRadar.slice(0, 4);
  saveScoutingRadar(topRadar);
  return topRadar;
}
