/**
 * Módulo de Evaluación de Competencia Interna por Puesto en Club Real
 * 
 * Analiza con qué compañeros de equipo compite un jugador en su club real
 * de LaLiga, calculando el nivel de competencia interna, riesgo de rotación
 * y probabilidad de minutos como titular.
 */

export const LALIGA_CLUB_DEPTH_CHARTS = {
  'barcelona': {
    keeper: ['Ter Stegen', 'Iñaki Peña', 'Szczesny'],
    defender: ['Pau Cubarsí', 'Jules Koundé', 'Andreas Christensen', 'Alejandro Balde', 'Eric García', 'Héctor Fort', 'Gerard Martín'],
    midfielder: ['Pedri', 'Gavi', 'Frenkie de Jong', 'Dani Olmo', 'Marc Casadó', 'Fermín López', 'Pablo Torre', 'Marc Bernal'],
    striker: ['Robert Lewandowski', 'Lamine Yamal', 'Raphinha', 'Ferran Torres', 'Pau Víctor', 'Ansu Fati']
  },
  'real madrid': {
    keeper: ['Thibaut Courtois', 'Andriy Lunin'],
    defender: ['Antonio Rüdiger', 'Éder Militão', 'Dani Carvajal', 'Ferland Mendy', 'David Alaba', 'Lucas Vázquez', 'Fran García'],
    midfielder: ['Jude Bellingham', 'Federico Valverde', 'Eduardo Camavinga', 'Aurélien Tchouaméni', 'Luka Modric', 'Dani Ceballos', 'Arda Güler'],
    striker: ['Kylian Mbappé', 'Vinicius Jr', 'Rodrygo', 'Brahim Díaz', 'Endrick']
  },
  'atletico': {
    keeper: ['Jan Oblak', 'Juan Musso'],
    defender: ['Robin Le Normand', 'José María Giménez', 'César Azpilicueta', 'Nahuel Molina', 'Javi Galán', 'Reinildo', 'Clément Lenglet', 'Axel Witsel'],
    midfielder: ['Rodrigo De Paul', 'Koke', 'Conor Gallagher', 'Pablo Barrios', 'Marcos Llorente', 'Thomas Lemar'],
    striker: ['Antoine Griezmann', 'Julián Álvarez', 'Alexander Sorloth', 'Ángel Correa', 'Giuliano Simeone']
  },
  'athletic': {
    keeper: ['Unai Simón', 'Julen Agirrezabala'],
    defender: ['Daniel Vivian', 'Aitor Paredes', 'Yeray Álvarez', 'Yuri Berchiche', 'Óscar de Marcos', 'Andoni Gorosabel', 'Iñigo Lekue'],
    midfielder: ['Oihan Sancet', 'Beñat Prados', 'Mikel Vesga', 'Iñigo Ruiz de Galarreta', 'Unai Gómez', 'Ander Herrera', 'Mikel Jauregizar'],
    striker: ['Nico Williams', 'Iñaki Williams', 'Gorka Guruzeta', 'Álvaro Djaló', 'Alex Berenguer', 'Javier Martón']
  },
  'real sociedad': {
    keeper: ['Álex Remiro', 'Unai Marrero'],
    defender: ['Igor Zubeldia', 'Jon Pacheco', 'Jon Aramburu', 'Javi López', 'Hamari Traoré', 'Aihen Muñoz', 'Nayef Aguerd', 'Aritz Elustondo', 'Jon Martín'],
    midfielder: ['Martín Zubimendi', 'Brais Méndez', 'Luka Sucic', 'Sergio Gómez', 'Beñat Turrientes', 'Pablo Marín', 'Jon Olasagasti', 'Urko González'],
    striker: ['Mikel Oyarzabal', 'Takefusa Kubo', 'Orri Óskarsson', 'Sheraldo Becker', 'Ander Barrenetxea', 'Sadiq Umar']
  },
  'celta': {
    keeper: ['Vicente Guaita', 'Iván Villar'],
    defender: ['Marcos Alonso', 'Carl Starfelt', 'Jailson', 'Javi Rodríguez', 'Mihailo Ristic', 'Óscar Mingueza', 'Sergio Carreira', 'Carlos Domínguez', 'Joseph Aidoo'],
    midfielder: ['Fran Beltrán', 'Hugo Sotelo', 'Damián Rodríguez', 'Ilaix Moriba', 'Hugo Álvarez', 'Williot Swedberg', 'Franco Cervi'],
    striker: ['Iago Aspas', 'Borja Iglesias', 'Anastasios Douvikas', 'Jonathan Bamba', 'Alfon González', 'Pablo Durán']
  },
  'osasuna': {
    keeper: ['Sergio Herrera', 'Aitor Fernández'],
    defender: ['Alejandro Catena', 'Flavien Boyomo', 'Enzo Boyomo', 'Jesús Areso', 'Juan Cruz', 'Unai García', 'Jorge Herrando', 'Nacho Vidal'],
    midfielder: ['Lucas Torró', 'Jon Moncayola', 'Aimar Oroz', 'Moi Gómez', 'Pablo Ibáñez', 'Iker Muñoz', 'Kike Barja'],
    striker: ['Ante Budimir', 'Bryan Zaragoza', 'Raúl García de Haro', 'Rubén Peña', 'Rubén García', 'José Arnaiz']
  },
  'villarreal': {
    keeper: ['Diego Conde', 'Luiz Júnior'],
    defender: ['Raúl Albiol', 'Logan Costa', 'Willy Kambwala', 'Aïssa Mandi', 'Sergi Cardona', 'Kiko Femenía', 'Juan Foyth', 'Alfonso Pedraza'],
    midfielder: ['Dani Parejo', 'Santi Comesaña', 'Pape Gueye', 'Denis Suárez', 'Álex Baena', 'Ilias Akhomach', 'Ramón Terrats'],
    striker: ['Gerard Moreno', 'Ayoze Pérez', 'Nicolas Pépé', 'Thierno Barry', 'Yeremy Pino']
  },
  'betis': {
    keeper: ['Rui Silva', 'Adrián San Miguel', 'Fran Vieites'],
    defender: ['Diego Llorente', 'Natan', 'Marc Bartra', 'Romain Perraud', 'Youssouf Sabaly', 'Héctor Bellerín', 'Ricardo Rodríguez', 'Junior Firpo'],
    midfielder: ['Giovani Lo Celso', 'Johnny Cardoso', 'Marc Roca', 'William Carvalho', 'Pablo Fornals', 'Isco', 'Sergi Altimira'],
    striker: ['Vitor Roque', 'Chimy Ávila', 'Cédric Bakambu', 'Assane Diao', 'Abde Ezzalzouli', 'Juanmi']
  },
  'getafe': {
    keeper: ['David Soria', 'Jiri Letacek'],
    defender: ['Djené Dakonam', 'Omar Alderete', 'Juan Berrocal', 'Diego Rico', 'Fabrizio Angileri', 'Allan Nyom', 'Juan Iglesias'],
    midfielder: ['Mauro Arambarri', 'Luis Milla', 'Carles Aleñá', 'Chrisantus Uche', 'Yellu Santiago', 'Álvaro Rodríguez'],
    striker: ['Borja Mayoral', 'Bertug Yildirim', 'Peter Federico', 'Álex Sola', 'Carles Pérez']
  }
};

function normalizeClubName(club) {
  if (!club) return '';
  const c = club.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
  return c;
}

export function evaluateClubCompetition(player, allKnownPlayers = []) {
  const pName = (player.name || player.playerName || '').trim();
  const rawClub = player.club || player.teamName || player.team || '';
  const normClub = normalizeClubName(rawClub);
  const pos = (player.type || player.position || 'midfielder').toLowerCase();

  let rivals = [];

  if (LALIGA_CLUB_DEPTH_CHARTS[normClub]) {
    const clubChart = LALIGA_CLUB_DEPTH_CHARTS[normClub];
    const posList = clubChart[pos] || [];
    rivals = posList.filter(n => !n.toLowerCase().includes(pName.toLowerCase()) && !pName.toLowerCase().includes(n.toLowerCase()));
  }

  if (rivals.length === 0 && allKnownPlayers.length > 0 && normClub) {
    const teammates = allKnownPlayers.filter(other => {
      const otherClub = normalizeClubName(other.club || other.teamName || other.team || '');
      const otherPos = (other.type || other.position || '').toLowerCase();
      const otherName = (other.name || other.playerName || '').trim();
      return otherClub === normClub && otherPos === pos && otherName.toLowerCase() !== pName.toLowerCase();
    });
    rivals = teammates.map(t => t.name || t.playerName);
  }

  const avgPts = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : (player.ppm || 0)) || 0;
  const historyList = Array.isArray(player.historical)
    ? player.historical
    : (player.historical?.points || player.historicalPoints || []);
  const validPoints = historyList.map(h => parseInt(h.points) || 0).filter(p => p > 0);
  const bestHist = validPoints.length > 0 ? Math.max(...validPoints) : 0;

  let competitionLevel = 'MEDIA';
  let confidencePct = 75;
  let isUndisputed = false;
  let rotationRisk = 'Moderado (Rotaciones en semanas de 2 partidos)';
  let mainRival = rivals.length > 0 ? rivals[0] : 'Ninguno';

  if (avgPts >= 5.0 || bestHist >= 140) {
    isUndisputed = true;
    competitionLevel = 'BAJA';
    confidencePct = 95;
    rotationRisk = 'Mínimo (Titular indiscutible / Eje del equipo)';
  } else if (avgPts >= 4.0 || bestHist >= 120) {
    competitionLevel = rivals.length >= 4 ? 'MEDIA' : 'BAJA';
    confidencePct = 75;
    rotationRisk = 'Moderado (Rotaciones habituales en club grande)';
  } else if (rivals.length >= 4) {
    competitionLevel = 'ALTA';
    confidencePct = 55;
    rotationRisk = 'Alto (Puesto muy disputado / Alta rotación)';
  } else if (rivals.length <= 1) {
    competitionLevel = 'BAJA';
    confidencePct = 90;
    rotationRisk = 'Bajo (Especialista solitario en su posición)';
  } else {
    if (avgPts >= 3.5 || bestHist >= 90) {
      competitionLevel = 'MEDIA';
      confidencePct = 70;
      rotationRisk = 'Bajo-Moderado (Ventaja sobre el suplente)';
    } else {
      competitionLevel = 'ALTA';
      confidencePct = 50;
      rotationRisk = 'Alto (Riesgo de suplencia o minutos residuales)';
    }
  }

  const reasoning = rivals.length > 0
    ? `Compite en ${rawClub || 'su club'} con ${rivals.slice(0, 3).join(', ')}${rivals.length > 3 ? '...' : ''} (Nivel: ${competitionLevel}, Confianza XI: ${confidencePct}%)`
    : `Sin competencia directa registrada en su puesto (Confianza XI: ${confidencePct}%)`;

  return {
    competitionLevel,
    confidencePct,
    directRivals: rivals,
    mainRival,
    isUndisputed,
    rotationRisk,
    reasoning
  };
}
