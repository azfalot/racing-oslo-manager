import fs from 'fs';
import path from 'path';

const RADAR_FILE = path.resolve('scouting_radar.json');

// Lista base de objetivos manuales prioritarios
const DEFAULT_WISHLIST = [
  { name: "Grimaldo", fullName: "Álex Grimaldo", position: "defender", priority: 1, targetPrice: 11070000, estimatedPts: 195, compTarget: "Álvaro Núñez / Mandi", autoDiscovered: false },
  { name: "Fornals", fullName: "Pablo Fornals", position: "midfielder", priority: 2, targetPrice: 11460000, estimatedPts: 175, compTarget: "Moi Gómez / Hugo Álvarez", autoDiscovered: false },
  { name: "Kang-In Lee", fullName: "Kang-In Lee", position: "midfielder", priority: 3, targetPrice: 15370000, estimatedPts: 165, compTarget: "Moi Gómez", autoDiscovered: false },
  { name: "Aubameyang", fullName: "Pierre-Emerick Aubameyang", position: "striker", priority: 4, targetPrice: 17160000, estimatedPts: 185, compTarget: "Pablo Durán", autoDiscovered: false },
  { name: "Gordon", fullName: "Anthony Gordon", position: "striker", priority: 5, targetPrice: 17080000, estimatedPts: 180, compTarget: "Pablo Durán", autoDiscovered: false }
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
 * 1. Auto-descubre jugadores que mejoren en +35 puntos al titular de su posición.
 * 2. Si un jugador se lo lleva un rival, se ignora/descarta a no ser que el rival lo ponga a la venta en el mercado.
 */
export function auditAndSyncScoutingRadar(marketPlayers = [], squad = { players: [] }, engine) {
  const radar = loadScoutingRadar();
  const currentSquad = squad.players || [];
  const myIds = new Set(currentSquad.map(p => p.playerId || p.id));

  // 1. Obtener la referencia de puntos del titular de menor puntuación por posición
  const posBaseline = {
    keeper: 0,
    defender: 0,
    midfielder: 0,
    striker: 0
  };

  const posStarters = {
    keeper: [],
    defender: [],
    midfielder: [],
    striker: []
  };

  currentSquad.forEach(p => {
    const pos = p.type || p.position || 'defender';
    const proj = engine ? engine.getSeasonProjection(p) : (p.totalPoints || 0);
    if (posStarters[pos]) {
      posStarters[pos].push({ name: p.name, proj });
    }
  });

  // Ordenar de mayor a menor y tomar el corte de titular
  for (const [pos, list] of Object.entries(posStarters)) {
    list.sort((a, b) => b.proj - a.proj);
    if (pos === 'keeper') posBaseline[pos] = list[0]?.proj || 120;
    else if (pos === 'defender') posBaseline[pos] = list[2]?.proj || 110; // 3º defensa
    else if (pos === 'midfielder') posBaseline[pos] = list[3]?.proj || 120; // 4º medio
    else if (pos === 'striker') posBaseline[pos] = list[1]?.proj || 130; // 2º delantero
  }

  // 2. Revisar cada jugador en el mercado
  marketPlayers.forEach(mp => {
    const mpId = mp.playerId || mp.id;
    if (myIds.has(mpId)) return; // Ya es nuestro

    const mpName = mp.name;
    const mpPos = mp.type || mp.position || 'defender';
    const mpPrice = mp.price || 0;
    const mpProj = engine ? engine.getSeasonProjection(mp) : 0;
    const baseline = posBaseline[mpPos] || 110;
    const netGain = mpProj - baseline;

    const isComputer = !mp.owner || mp.owner === 'Computer' || mp.owner?.name === 'Computer' || mp.owner?.username === 'Computer';
    const ownerName = isComputer ? 'Computer' : (mp.owner?.name || mp.ownerName || 'Rival');

    // Buscar si ya está en el radar
    const existingIdx = radar.findIndex(r => r.name.toLowerCase() === mpName.toLowerCase() || (r.playerId && r.playerId === mpId));

    // REGLA: Si mejora en +35 puntos sobre el titular
    if (netGain >= 35 && mpPrice > 2000000) {
      if (existingIdx === -1) {
        // Encontrar a quién mejoraría
        const weakestStarter = (posStarters[mpPos] || [])[posStarters[mpPos]?.length - 1]?.name || 'Titular rotación';
        
        console.log(`[SCOUTING-RADAR] 🌟 ¡Nuevo objetivo detectado! ${mpName} (+${netGain.toFixed(0)} pts vs ${weakestStarter}, ${mpPrice.toLocaleString()} €)`);
        radar.push({
          playerId: mpId,
          name: mpName,
          fullName: mpName,
          position: mpPos,
          priority: netGain >= 50 ? 1 : 2,
          targetPrice: mpPrice,
          estimatedPts: mpProj,
          netGain: Math.round(netGain),
          compTarget: weakestStarter,
          owner: ownerName,
          onMarket: true,
          autoDiscovered: true,
          addedAt: new Date().toISOString()
        });
      } else {
        // Actualizar datos del objetivo existente
        radar[existingIdx].targetPrice = mpPrice;
        radar[existingIdx].estimatedPts = mpProj;
        radar[existingIdx].onMarket = true;
        radar[existingIdx].owner = ownerName;
      }
    } else if (existingIdx !== -1) {
      // Ya estaba en la wishlist: actualizar estado de mercado
      radar[existingIdx].targetPrice = mpPrice;
      radar[existingIdx].onMarket = true;
      radar[existingIdx].owner = ownerName;
    }
  });

  // 3. Ordenar radar por prioridad y ganancia neta
  radar.sort((a, b) => (a.priority || 99) - (b.priority || 99) || (b.estimatedPts || 0) - (a.estimatedPts || 0));

  saveScoutingRadar(radar);
  return radar;
}
