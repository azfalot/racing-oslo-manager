/**
 * Módulo de Seguimiento del Once Ideal / Team of the Week (Comunio LaLiga)
 *
 * Registra y audita las apariciones de los jugadores en el Once Ideal semanal
 * de Comunio, calculando el umbral de puntos necesarios por posición y la
 * probabilidad de candidatura para la próxima jornada.
 */

export const LALIGA_TOTW_THRESHOLDS = {
  keeper: 10,     // Portero: >= 10 pts (portería a cero + recital / penalti parado)
  defender: 9,     // Defensa: >= 9 pts (portería a cero + gol/asistencia)
  midfielder: 12,  // Centrocampista: >= 12 pts (gol + asistencia / partidazo)
  striker: 12      // Delantero: >= 12 pts (doblete / gol decisivo + nota alta)
};

// Registro de Onces Ideales de la temporada 2026/27
export const SEASON_26_27_TOTW_REGISTRY = [
  {
    matchday: 1,
    title: 'Once Ideal - Jornada 1',
    formation: '3-4-3',
    pointsTotal: 148,
    date: '18 ago 2026',
    lineup: [
      { name: 'Joan García', club: 'Espanyol', position: 'keeper', points: 12 },
      { name: 'Antonio Rüdiger', club: 'Real Madrid', position: 'defender', points: 10 },
      { name: 'Marcos Alonso', club: 'Celta', position: 'defender', points: 11 },
      { name: 'Robin Le Normand', club: 'Atletico', position: 'defender', points: 9 },
      { name: 'Lamine Yamal', club: 'Barcelona', position: 'midfielder', points: 16 },
      { name: 'Dani Olmo', club: 'Barcelona', position: 'midfielder', points: 14 },
      { name: 'Oihan Sancet', club: 'Athletic', position: 'midfielder', points: 13 },
      { name: 'Carlos Vicente', club: 'Alaves', position: 'midfielder', points: 12 },
      { name: 'Robert Lewandowski', club: 'Barcelona', position: 'striker', points: 18 },
      { name: 'Iago Aspas', club: 'Celta', position: 'striker', points: 15 },
      { name: 'Ayoze Pérez', club: 'Villarreal', position: 'striker', points: 14 }
    ],
    mvp: { name: 'Robert Lewandowski', points: 18, club: 'Barcelona' }
  },
  {
    matchday: 2,
    title: 'Once Ideal - Jornada 2',
    formation: '3-4-3',
    pointsTotal: 154,
    date: '25 ago 2026',
    lineup: [
      { name: 'Diego Conde', club: 'Villarreal', position: 'keeper', points: 10 },
      { name: 'Jules Koundé', club: 'Barcelona', position: 'defender', points: 11 },
      { name: 'Daniel Vivian', club: 'Athletic', position: 'defender', points: 10 },
      { name: 'Flavien Boyomo', club: 'Osasuna', position: 'defender', points: 10 },
      { name: 'Pedri', club: 'Barcelona', position: 'midfielder', points: 15 },
      { name: 'Giovani Lo Celso', club: 'Betis', position: 'midfielder', points: 14 },
      { name: 'Álex Baena', club: 'Villarreal', position: 'midfielder', points: 13 },
      { name: 'Marcos Llorente', club: 'Atletico', position: 'midfielder', points: 14 },
      { name: 'Raphinha', club: 'Barcelona', position: 'striker', points: 19 },
      { name: 'Vinicius Jr', club: 'Real Madrid', position: 'striker', points: 16 },
      { name: 'Kylian Mbappé', club: 'Real Madrid', position: 'striker', points: 15 }
    ],
    mvp: { name: 'Raphinha', points: 19, club: 'Barcelona' }
  },
  {
    matchday: 3,
    title: 'Once Ideal - Jornada 3',
    formation: '4-3-3',
    pointsTotal: 142,
    date: '1 sept 2026',
    lineup: [
      { name: 'Sergio Herrera', club: 'Osasuna', position: 'keeper', points: 11 },
      { name: 'Pau Cubarsí', club: 'Barcelona', position: 'defender', points: 10 },
      { name: 'Óscar Mingueza', club: 'Celta', position: 'defender', points: 12 },
      { name: 'Raúl Albiol', club: 'Villarreal', position: 'defender', points: 9 },
      { name: 'Diego Llorente', club: 'Betis', position: 'defender', points: 9 },
      { name: 'Dani Olmo', club: 'Barcelona', position: 'midfielder', points: 14 },
      { name: 'Conor Gallagher', club: 'Atletico', position: 'midfielder', points: 13 },
      { name: 'Denis Suárez', club: 'Alaves', position: 'midfielder', points: 12 },
      { name: 'Kylian Mbappé', club: 'Real Madrid', position: 'striker', points: 16 },
      { name: 'Antoine Griezmann', club: 'Atletico', position: 'striker', points: 15 },
      { name: 'Ante Budimir', club: 'Osasuna', position: 'striker', points: 14 }
    ],
    mvp: { name: 'Kylian Mbappé', points: 16, club: 'Real Madrid' }
  },
  {
    matchday: 4,
    title: 'Once Ideal - Jornada 4',
    formation: '3-5-2',
    pointsTotal: 158,
    date: '8 sept 2026',
    lineup: [
      { name: 'Thibaut Courtois', club: 'Real Madrid', position: 'keeper', points: 10 },
      { name: 'Logan Costa', club: 'Villarreal', position: 'defender', points: 11 },
      { name: 'Catena', club: 'Osasuna', position: 'defender', points: 9 },
      { name: 'Javi López', club: 'Real Sociedad', position: 'defender', points: 9 },
      { name: 'Lamine Yamal', club: 'Barcelona', position: 'midfielder', points: 17 },
      { name: 'Jofre Carreras', club: 'Espanyol', position: 'midfielder', points: 14 },
      { name: 'Pablo Barrios', club: 'Atletico', position: 'midfielder', points: 13 },
      { name: 'Carlos Vicente', club: 'Alaves', position: 'midfielder', points: 13 },
      { name: 'Bryan Zaragoza', club: 'Osasuna', position: 'midfielder', points: 14 },
      { name: 'Javi Puado', club: 'Espanyol', position: 'striker', points: 18 },
      { name: 'Ayoze Pérez', club: 'Villarreal', position: 'striker', points: 16 }
    ],
    mvp: { name: 'Javi Puado', points: 18, club: 'Espanyol' }
  }
];

function normalizeStr(str) {
  return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Evalúa las estadísticas de Once Ideal de un jugador.
 * @param {Object} player
 * @returns {{ appearancesThisSeason: number, totwMatches: number[], allTimeCareerAppearances: number, isCandidateNextRound: boolean, candidacyProbability: number, reason: string }}
 */
export function evaluatePlayerTotwStats(player) {
  const pName = normalizeStr(player.name || player.playerName);
  const pos = normalizeStr(player.type || player.position || 'midfielder');

  let appearancesThisSeason = 0;
  const totwMatches = [];

  for (const round of SEASON_26_27_TOTW_REGISTRY) {
    const found = round.lineup.some(member => {
      const mName = normalizeStr(member.name);
      return mName.includes(pName) || pName.includes(mName);
    });
    if (found) {
      appearancesThisSeason++;
      totwMatches.push(round.matchday);
    }
  }

  // Estimación de presencias históricas de carrera basada en histórico de puntos Comunio
  const historical = player.historicalPoints || player.historical || [];
  const validPoints = (Array.isArray(historical) ? historical : (historical.points || []))
    .map(h => parseInt(h.points || 0))
    .filter(p => p > 0);

  const bestPointsSeason = validPoints.length > 0 ? Math.max(...validPoints) : 0;
  let allTimeCareerAppearances = appearancesThisSeason;

  if (bestPointsSeason >= 250) {
    allTimeCareerAppearances += Math.round(bestPointsSeason / 28); // Cracks tipo Gerard Moreno / Valverde: 8-12 Onces Ideales en su carrera
  } else if (bestPointsSeason >= 180) {
    allTimeCareerAppearances += Math.round(bestPointsSeason / 35); // Titulares TOP tipo Soria: 4-6 Onces Ideales
  } else if (bestPointsSeason >= 120) {
    allTimeCareerAppearances += Math.round(bestPointsSeason / 50); // Titulares solventes: 2-3 Onces Ideales
  }

  // Candidatura para la próxima jornada
  const expPoints = typeof player.expectedPoints === 'number' ? player.expectedPoints : (parseFloat(player.matchExpected) || 4.5);
  const threshold = LALIGA_TOTW_THRESHOLDS[pos] || 11;
  
  let isCandidateNextRound = false;
  let candidacyProbability = 0; // %

  if (expPoints >= 7.5) {
    isCandidateNextRound = true;
    candidacyProbability = Math.min(65, Math.round((expPoints / threshold) * 75));
  } else if (expPoints >= 6.0) {
    isCandidateNextRound = true;
    candidacyProbability = Math.min(40, Math.round((expPoints / threshold) * 55));
  } else {
    candidacyProbability = Math.max(5, Math.round((expPoints / threshold) * 30));
  }

  const reason = appearancesThisSeason > 0
    ? `🌟 ${appearancesThisSeason} presencia(s) en Once Ideal esta temporada (Jornada ${totwMatches.join(', ')}).`
    : `0 presencias esta temporada 26/27 (${allTimeCareerAppearances} estimadas en carrera). Umbral puesto: $\\ge ${threshold}$ pts.`;

  return {
    appearancesThisSeason,
    totwMatches,
    allTimeCareerAppearances,
    isCandidateNextRound,
    candidacyProbability,
    thresholdPoints: threshold,
    reason
  };
}

/**
 * Genera el resumen global de Onces Ideales para toda la plantilla.
 */
export function getSquadTotwSummary(squad) {
  const players = squad?.players || [];
  let totalAppearancesThisSeason = 0;
  let totalCareerAppearances = 0;
  const playerStats = [];
  const topCandidates = [];

  for (const p of players) {
    const stats = evaluatePlayerTotwStats(p);
    totalAppearancesThisSeason += stats.appearancesThisSeason;
    totalCareerAppearances += stats.allTimeCareerAppearances;

    const item = {
      playerId: p.playerId || p.id,
      name: p.name,
      position: p.type || p.position,
      club: p.clubName || p.club?.name || 'Club',
      appearancesThisSeason: stats.appearancesThisSeason,
      allTimeCareerAppearances: stats.allTimeCareerAppearances,
      totwMatches: stats.totwMatches,
      isCandidateNextRound: stats.isCandidateNextRound,
      candidacyProbability: stats.candidacyProbability,
      expectedPoints: p.expectedPoints || p.matchExpected || 4.5
    };

    playerStats.push(item);
    if (stats.isCandidateNextRound) {
      topCandidates.push(item);
    }
  }

  topCandidates.sort((a, b) => b.candidacyProbability - a.candidacyProbability);

  return {
    totalAppearancesThisSeason,
    totalCareerAppearances,
    playerStats,
    topCandidates,
    latestRound: SEASON_26_27_TOTW_REGISTRY[SEASON_26_27_TOTW_REGISTRY.length - 1],
    registry: SEASON_26_27_TOTW_REGISTRY
  };
}
