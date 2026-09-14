/**
 * Módulo de Especialistas a Balón Parado y Lanzadores de Penaltis (LaLiga EA Sports)
 *
 * Mapea los lanzadores oficiales de penaltis (1º y 2º), faltas directas y saques de esquina
 * para todos los clubes de Primera División.
 * 
 * Los lanzadores de penaltis e implicados a balón parado reciben una bonificación en PPM
 * (+0.10 a +0.50 PPM) debido a su mayor probabilidad de generar goles y asistencias directas.
 */

import { normalizeClubName } from './clubMomentum.js';

export const LALIGA_SET_PIECES_DATA = {
  'villarreal': {
    penalties: ['Gerard Moreno', 'Dani Parejo', 'Ayoze Pérez'],
    freeKicks: ['Dani Parejo', 'Álex Baena', 'Gerard Moreno'],
    corners: ['Dani Parejo', 'Álex Baena', 'Denis Suárez', 'Terrats']
  },
  'valencia': {
    penalties: ['Pepelu', 'Hugo Duro', 'André Almeida'],
    freeKicks: ['Pepelu', 'André Almeida', 'Diego López'],
    corners: ['Pepelu', 'André Almeida', 'Rioja']
  },
  'real madrid': {
    penalties: ['Vinicius Jr', 'Kylian Mbappé', 'Jude Bellingham'],
    freeKicks: ['Federico Valverde', 'Kylian Mbappé', 'Arda Güler', 'Luka Modric', 'David Alaba'],
    corners: ['Luka Modric', 'Arda Güler', 'Rodrygo']
  },
  'barcelona': {
    penalties: ['Robert Lewandowski', 'Raphinha', 'Dani Olmo'],
    freeKicks: ['Raphinha', 'Dani Olmo', 'Ferran Torres'],
    corners: ['Raphinha', 'Lamine Yamal', 'Pedri', 'Dani Olmo']
  },
  'atletico': {
    penalties: ['Antoine Griezmann', 'Julián Álvarez', 'Alexander Sorloth'],
    freeKicks: ['Antoine Griezmann', 'Rodrigo De Paul', 'Julián Álvarez'],
    corners: ['Antoine Griezmann', 'Rodrigo De Paul', 'Koke']
  },
  'athletic': {
    penalties: ['Oihan Sancet', 'Alex Berenguer', 'Mikel Vesga', 'Iñaki Williams'],
    freeKicks: ['Alex Berenguer', 'Oihan Sancet', 'Unai Gómez'],
    corners: ['Alex Berenguer', 'Nico Williams', 'Iñigo Ruiz de Galarreta']
  },
  'real sociedad': {
    penalties: ['Mikel Oyarzabal', 'Brais Méndez', 'Sergio Gómez'],
    freeKicks: ['Brais Méndez', 'Sergio Gómez', 'Takefusa Kubo'],
    corners: ['Sergio Gómez', 'Brais Méndez', 'Takefusa Kubo']
  },
  'osasuna': {
    penalties: ['Ante Budimir', 'Aimar Oroz', 'Rubén García'],
    freeKicks: ['Rubén García', 'Moi Gómez', 'Bryan Zaragoza'],
    corners: ['Rubén García', 'Moi Gómez', 'Bryan Zaragoza']
  },
  'celta': {
    penalties: ['Iago Aspas', 'Borja Iglesias', 'Anastasios Douvikas'],
    freeKicks: ['Iago Aspas', 'Óscar Mingueza', 'Hugo Álvarez'],
    corners: ['Iago Aspas', 'Hugo Álvarez', 'Damián Rodríguez', 'Óscar Mingueza']
  },
  'betis': {
    penalties: ['Giovani Lo Celso', 'Chimy Ávila', 'Vitor Roque', 'Isco'],
    freeKicks: ['Giovani Lo Celso', 'Isco', 'Ricardo Rodríguez'],
    corners: ['Giovani Lo Celso', 'Pablo Fornals', 'Isco']
  },
  'alaves': {
    penalties: ['Carlos Vicente', 'Kike García', 'Denis Suárez', 'Joan Jordán'],
    freeKicks: ['Carlos Vicente', 'Joan Jordán', 'Denis Suárez'],
    corners: ['Carlos Vicente', 'Joan Jordán', 'Denis Suárez', 'Carles Protesoni']
  },
  'espanyol': {
    penalties: ['Javi Puado', 'Pere Milla', 'Walid Cheddira'],
    freeKicks: ['Álex Král', 'Jofre Carreras', 'Pere Milla'],
    corners: ['Jofre Carreras', 'Álex Král', 'Edu Expósito']
  },
  'mallorca': {
    penalties: ['Vedat Muriqi', 'Abdón Prats', 'Sergi Darder'],
    freeKicks: ['Sergi Darder', 'Dani Rodríguez', 'Antonio Sánchez'],
    corners: ['Sergi Darder', 'Dani Rodríguez', 'Chiquinho']
  },
  'rayo vallecano': {
    penalties: ['Isi Palazón', 'James Rodríguez', 'Raúl de Tomás', 'Óscar Trejo'],
    freeKicks: ['James Rodríguez', 'Isi Palazón', 'Florian Lejeune'],
    corners: ['James Rodríguez', 'Isi Palazón', 'Gerard Gumbau']
  },
  'getafe': {
    penalties: ['Borja Mayoral', 'Mauro Arambarri', 'Luis Milla'],
    freeKicks: ['Luis Milla', 'Mauro Arambarri', 'Carles Pérez'],
    corners: ['Luis Milla', 'Carles Pérez', 'Diego Rico']
  },
  'girona': {
    penalties: ['Cristhian Stuani', 'Viktor Tsygankov', 'Abel Ruiz'],
    freeKicks: ['Viktor Tsygankov', 'Yangel Herrera', 'Bryan Gil'],
    corners: ['Viktor Tsygankov', 'Bryan Gil', 'Miguel Gutiérrez']
  },
  'sevilla': {
    penalties: ['Dodi Lukebakio', 'Suso', 'Isaac Romero', 'Saúl Ñíguez'],
    freeKicks: ['Suso', 'Saúl Ñíguez', 'Dodi Lukebakio'],
    corners: ['Suso', 'Valentín Barco', 'Chidera Ejuke']
  },
  'leganes': {
    penalties: ['Dani Raba', 'Juan Cruz', 'Miguel de la Fuente'],
    freeKicks: ['Juan Cruz', 'Óscar Rodríguez', 'Dani Raba'],
    corners: ['Juan Cruz', 'Óscar Rodríguez', 'Roberto López']
  },
  'las palmas': {
    penalties: ['Sandro Ramírez', 'Fábio Silva', 'Kirian Rodríguez', 'Jaime Mata'],
    freeKicks: ['Sandro Ramírez', 'Kirian Rodríguez', 'Alberto Moleiro'],
    corners: ['Kirian Rodríguez', 'Sandro Ramírez', 'Alberto Moleiro']
  },
  'valladolid': {
    penalties: ['Mamadou Sylla', 'Raúl Moro', 'Kike Pérez'],
    freeKicks: ['Kike Pérez', 'Raúl Moro', 'Mario Martín'],
    corners: ['Raúl Moro', 'Kike Pérez', 'Amath Ndiaye']
  }
};

function matchesName(candidateName, targetName) {
  if (!candidateName || !targetName) return false;
  const c = candidateName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const t = targetName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return c.includes(t) || t.includes(c);
}

/**
 * Evalúa si un jugador es lanzador de penaltis, faltas o saques de esquina en su club.
 * @param {Object|string} player Objeto jugador o nombre de jugador
 * @param {string} [clubOverride] Club opcional si player es solo nombre
 * @returns {{ isPrimaryPenalty: boolean, isSecondaryPenalty: boolean, isFreeKick: boolean, isCorner: boolean, bonusPpm: number, roleLabel: string, details: string }}
 */
export function evaluateSetPieceSpecialist(player, clubOverride = null) {
  const pName = typeof player === 'string' ? player : (player.name || player.playerName || '');
  const rawClub = clubOverride || (typeof player === 'object' ? (player.club?.name || player.club || player.clubName || player.teamName || player.team || '') : '');
  const normClub = normalizeClubName(rawClub);

  const clubData = LALIGA_SET_PIECES_DATA[normClub];
  if (!clubData || !pName) {
    return {
      isPrimaryPenalty: false,
      isSecondaryPenalty: false,
      isFreeKick: false,
      isCorner: false,
      bonusPpm: 0,
      roleLabel: 'Sin rol asignado a balón parado',
      details: 'No figura como especialista principal en penaltis o faltas.'
    };
  }

  const penalties = clubData.penalties || [];
  const freeKicks = clubData.freeKicks || [];
  const corners = clubData.corners || [];

  const isPrimaryPenalty = penalties.length > 0 && matchesName(pName, penalties[0]);
  const isSecondaryPenalty = !isPrimaryPenalty && penalties.slice(1).some(name => matchesName(pName, name));
  const isFreeKick = freeKicks.some(name => matchesName(pName, name));
  const isCorner = corners.some(name => matchesName(pName, name));

  let bonusPpm = 0;
  const roles = [];

  if (isPrimaryPenalty) {
    bonusPpm += 0.45;
    roles.push('🎯 1º Tirador Penaltis');
  } else if (isSecondaryPenalty) {
    bonusPpm += 0.20;
    roles.push('🎯 2º Tirador Penaltis');
  }

  if (isFreeKick) {
    bonusPpm += 0.15;
    roles.push('🚀 Faltas Directas');
  }

  if (isCorner) {
    bonusPpm += 0.10;
    roles.push('🚩 Córners');
  }

  // Acotar bonus máximo a +0.50 PPM
  bonusPpm = Math.min(0.50, parseFloat(bonusPpm.toFixed(2)));

  const roleLabel = roles.length > 0 ? roles.join(' · ') : 'Sin rol a balón parado';
  const details = roles.length > 0
    ? `Especialista en ${rawClub || 'su club'}: ${roles.join(', ')} (+${bonusPpm} PPM bonus).`
    : 'No figura en la terna principal de balón parado.';

  return {
    isPrimaryPenalty,
    isSecondaryPenalty,
    isFreeKick,
    isCorner,
    bonusPpm,
    roleLabel,
    details
  };
}
