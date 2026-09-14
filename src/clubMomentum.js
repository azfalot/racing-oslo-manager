/**
 * Módulo de Evaluación de Momentum y Estado Anímico de Clubes Reales de LaLiga
 *
 * Evalúa el momento competitivo real de cada club de Primera División:
 * - Racha de resultados (últimos 5 partidos)
 * - Estado de crisis / bloqueo anímico (ej. Villarreal con 0 victorias, Valencia en descenso)
 * - Estado de euforia / dinámica positiva (ej. Barcelona arrollador, Alavés, Espanyol)
 * - Sobrecarga de competiciones europeas (rotaciones y fatiga Champions/Europa/Conference)
 *
 * Aplica multiplicadores acotados [0.80x - 1.15x] para ajustar las expectativas de rendimiento.
 */

export const LALIGA_CLUB_MOMENTUM_DATA = {
  'barcelona': {
    state: 'SURGING',
    stateLabel: '🔥 Euforia / Líder Arrollador',
    multiplier: 1.10,
    pointsLast5: 15,
    formText: '5V 0E 0D - Ataque demoledor y máxima confianza colectiva',
    isEuropean: true
  },
  'real madrid': {
    state: 'STABLE_UEFA',
    stateLabel: '⚖️ Alto Nivel con Rotaciones Champions',
    multiplier: 0.95,
    pointsLast5: 11,
    formText: '3V 2E 0D - Exigencia máxima y rotaciones frecuentes por Champions League',
    isEuropean: true
  },
  'atletico': {
    state: 'SURGING',
    stateLabel: '🛡️ En Racha Positiva / Invictos',
    multiplier: 1.06,
    pointsLast5: 11,
    formText: '3V 2E 0D - Solidez defensiva y plantilla profunda',
    isEuropean: true
  },
  'athletic': {
    state: 'NEUTRAL',
    stateLabel: '⚖️ Competitivo / Desgaste Europa League',
    multiplier: 1.02,
    pointsLast5: 10,
    formText: '3V 1E 1D - Fuerte pero con calendario apretado en Europa',
    isEuropean: true
  },
  'alaves': {
    state: 'SURGING',
    stateLabel: '🚀 Estado de Gracia / Racha Histórica',
    multiplier: 1.06,
    pointsLast5: 10,
    formText: '3V 1E 1D - Alta efectividad colectiva y moral por las nubes',
    isEuropean: false
  },
  'espanyol': {
    state: 'SURGING',
    stateLabel: '🚀 Pico de Confianza / Racha Ascendente',
    multiplier: 1.08,
    pointsLast5: 9,
    formText: '3V 0E 2D - Creciendo en sensaciones y puntuaciones fantasy',
    isEuropean: false
  },
  'celta': {
    state: 'SURGING',
    stateLabel: '⚽ Alta Producción Ofensiva',
    multiplier: 1.05,
    pointsLast5: 9,
    formText: '3V 0E 2D - Fútbol vistoso con gran generación de ocasiones',
    isEuropean: false
  },
  'osasuna': {
    state: 'NEUTRAL',
    stateLabel: '🏟️ Fuerte en El Sadar / Regular',
    multiplier: 1.02,
    pointsLast5: 10,
    formText: '3V 1E 1D - Fiable en casa y regularidad táctica',
    isEuropean: false
  },
  'betis': {
    state: 'NEUTRAL',
    stateLabel: '⚖️ Regular / Carga Conference',
    multiplier: 0.98,
    pointsLast5: 8,
    formText: '2V 2E 1D - Ritmo irregular por desgaste europeo',
    isEuropean: true
  },
  'mallorca': {
    state: 'NEUTRAL',
    stateLabel: '🛡️ Bloque Rocoso / Puntuaciones Ajustadas',
    multiplier: 0.98,
    pointsLast5: 8,
    formText: '2V 2E 1D - Orden defensivo pero poca producción ofensiva',
    isEuropean: false
  },
  'rayo vallecano': {
    state: 'NEUTRAL',
    stateLabel: '⚖️ Ritmo Estable',
    multiplier: 0.98,
    pointsLast5: 7,
    formText: '2V 1E 2D - Rendimiento alternante',
    isEuropean: false
  },
  'girona': {
    state: 'NEUTRAL',
    stateLabel: '⚖️ Transición / Desgaste Champions',
    multiplier: 0.96,
    pointsLast5: 7,
    formText: '2V 1E 2D - Adaptándose a la exigencia de Champions League',
    isEuropean: true
  },
  'leganes': {
    state: 'NEUTRAL',
    stateLabel: '🛡️ Orden Defensivo / Techo Bajo',
    multiplier: 0.95,
    pointsLast5: 6,
    formText: '1V 3E 1D - Difícil de batir pero poco volumen de puntos fantasy',
    isEuropean: false
  },
  'real sociedad': {
    state: 'STRUGGLING',
    stateLabel: '📉 Dudas Iniciales / Bajas Sensibles',
    multiplier: 0.90,
    pointsLast5: 4,
    formText: '1V 1E 3D - Falta de pegada y lesiones en puestos clave',
    isEuropean: true
  },
  'sevilla': {
    state: 'STRUGGLING',
    stateLabel: '📉 Inestabilidad y Presión Social',
    multiplier: 0.88,
    pointsLast5: 5,
    formText: '1V 2E 2D - Dudas tácticas y tensión competitiva',
    isEuropean: false
  },
  'getafe': {
    state: 'STRUGGLING',
    stateLabel: '📉 Sequía Ofensiva / Plantilla Corta',
    multiplier: 0.88,
    pointsLast5: 3,
    formText: '0V 3E 2D - Sin victorias y escasa producción de goles',
    isEuropean: false
  },
  'las palmas': {
    state: 'CRISIS',
    stateLabel: '⚠️ Crisis / Sin Victorias',
    multiplier: 0.84,
    pointsLast5: 2,
    formText: '0V 2E 3D - Graves problemas defensivos y bloqueo mental',
    isEuropean: false
  },
  'valladolid': {
    state: 'CRISIS',
    stateLabel: '⚠️ Fragilidad / Puesto de Descenso',
    multiplier: 0.84,
    pointsLast5: 4,
    formText: '1V 1E 3D - Gran fragilidad atrás y goleadas encajadas',
    isEuropean: false
  },
  'villarreal': {
    state: 'CRISIS',
    stateLabel: '⚠️ Crisis Deportiva (0 Victorias) / Bloqueo Total',
    multiplier: 0.82,
    pointsLast5: 2,
    formText: '0V 2E 3D - 0 victorias en la temporada, depresión competitiva y bajas',
    isEuropean: false
  },
  'valencia': {
    state: 'CRISIS',
    stateLabel: '🚨 Crisis Institucional y Deportiva (Colista)',
    multiplier: 0.80,
    pointsLast5: 1,
    formText: '0V 1E 4D - Colista, generación ofensiva mínima y pesimismo',
    isEuropean: false
  }
};

export function normalizeClubName(club) {
  if (!club) return '';
  if (typeof club === 'object') {
    club = club.name || club.teamName || club.team || '';
  }
  const c = String(club).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (c.includes('espanyol') || c.includes('espanol')) return 'espanyol';
  if (c.includes('barca') || c.includes('barcelona')) return 'barcelona';
  if (c.includes('madrid') && !c.includes('atlet')) return 'real madrid';
  if (c.includes('atlet') || c.includes('atm')) return 'atletico';
  if (c.includes('athlet') || c.includes('bilbao')) return 'athletic';
  if (c.includes('sociedad') || c.includes('la real')) return 'real sociedad';
  if (c.includes('celta')) return 'celta';
  if (c.includes('osasuna')) return 'osasuna';
  if (c.includes('villarreal')) return 'villarreal';
  if (c.includes('betis')) return 'betis';
  if (c.includes('getafe')) return 'getafe';
  if (c.includes('alaves')) return 'alaves';
  if (c.includes('sevilla')) return 'sevilla';
  if (c.includes('valencia')) return 'valencia';
  if (c.includes('girona')) return 'girona';
  if (c.includes('mallorca')) return 'mallorca';
  if (c.includes('rayo')) return 'rayo vallecano';
  if (c.includes('leganes')) return 'leganes';
  if (c.includes('las palmas') || c.includes('palmas')) return 'las palmas';
  if (c.includes('valladolid')) return 'valladolid';
  return c;
}

/**
 * Evalúa el momentum real de club y devuelve el multiplicador y estado anímico.
 * @param {Object|string} playerOrClub Jugador o string con nombre de club
 * @returns {{ club: string, rawClub: string, momentumMultiplier: number, state: string, stateLabel: string, recentForm: string, pointsLast5: number, reasoning: string }}
 */
export function evaluateClubMomentum(playerOrClub) {
  let rawClub = '';
  if (typeof playerOrClub === 'string') {
    rawClub = playerOrClub;
  } else if (playerOrClub && typeof playerOrClub === 'object') {
    rawClub = playerOrClub.club?.name || playerOrClub.club || playerOrClub.teamName || playerOrClub.team || '';
  }

  const normClub = normalizeClubName(rawClub);
  const data = LALIGA_CLUB_MOMENTUM_DATA[normClub];

  if (data) {
    return {
      club: normClub,
      rawClub,
      momentumMultiplier: data.multiplier,
      state: data.state,
      stateLabel: data.stateLabel,
      recentForm: data.formText,
      pointsLast5: data.pointsLast5,
      reasoning: `${data.stateLabel} (${data.multiplier}x): ${data.formText}`
    };
  }

  // Baseline neutro por defecto
  return {
    club: normClub || 'desconocido',
    rawClub,
    momentumMultiplier: 1.00,
    state: 'NEUTRAL',
    stateLabel: '⚖️ Rendimiento Estable / Sin Datos Críticos',
    recentForm: 'Dinámica neutra de competición',
    pointsLast5: 7,
    reasoning: 'Rendimiento estándar sin impacto anímico extremo (1.00x).'
  };
}
