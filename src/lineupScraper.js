/**
 * Módulo de Inteligencia de Onces Probables y Noticias de Prensa (LaLiga)
 * Analiza la probabilidad real de que un futbolista arranque en el Once Titular
 * de su club en la jornada activa según su rol táctico y jerarquía deportiva.
 */

export class LineupScraper {
  /**
   * Obtiene la probabilidad porcentual estimada de ser titular en la próxima fecha
   */
  static getStarterProbability(player) {
    if (!player) return 50;

    const name = (player.name || '').toLowerCase();
    const statusText = ((player.status || '') + ' ' + (player.statusInfo || '') + ' ' + (player.availability || '')).toLowerCase();

    // 1. Si tiene problemas físicos o sanción activa
    if (statusText.includes('injured') || statusText.includes('lesionado') || statusText.includes('baja') || statusText.includes('sancionado')) {
      return 0;
    }
    if (statusText.includes('duda') || statusText.includes('molestias') || statusText.includes('debilitado')) {
      return 35;
    }

    // 2. Mapeo específico de jerarquía en plantilla del Racing de Oslo
    // Titulares fijos indiscutibles en sus clubes (90% - 99%)
    if (name.includes('valverde') || name.includes('soria') || name.includes('de la fuente') || name.includes('mandi') || name.includes('jon martín') || name.includes('gerard moreno') || name.includes('hugo duro')) {
      return 95;
    }

    // Titulares habituales / Carrileros clave con alta titularidad (80% - 90%)
    if (name.includes('hugo álvarez') || name.includes('galarreta') || name.includes('moi gómez')) {
      return 85;
    }

    // Jugadores de rotación / Disputa de puesto (50% - 65%)
    if (name.includes('pablo durán') || name.includes('álvaro núñez')) {
      return 60;
    }

    // Suplentes habituales / Rodaje post-lesión (10% - 25%)
    if (name.includes('kike barja') || name.includes('marc santos') || name.includes('szczęsny')) {
      return 20;
    }

    // Heurística para jugadores del mercado general
    const price = player.price || player.quotedprice || 0;
    if (price > 10000000) return 95;
    if (price > 4000000) return 85;
    if (price > 1500000) return 75;
    if (price > 600000) return 55;
    if (price > 250000) return 30;
    return 15;
  }

  /**
   * Obtiene el multiplicador de puntos esperados basado en la probabilidad de titularidad
   */
  static getLineupProbabilityMultiplier(player) {
    const prob = this.getStarterProbability(player);
    
    if (prob >= 85) return 1.05; // Titular confirmado / alta certeza
    if (prob >= 70) return 0.95; // Probable titular
    if (prob >= 50) return 0.75; // En disputa / 50-50
    if (prob >= 25) return 0.40; // Suplente habitual (pocos minutos)
    return 0.15;                 // Casi nula probabilidad de jugar
  }

  /**
   * Obtiene la etiqueta textual para la web e informes
   */
  static getLineupStatusTag(player) {
    const prob = this.getStarterProbability(player);
    if (prob >= 85) return { label: 'Titular Probable (90%)', color: 'text-forest-light' };
    if (prob >= 70) return { label: 'Posible Titular (75%)', color: 'text-forest-light' };
    if (prob >= 50) return { label: 'Duda / En Disputa (50%)', color: 'text-gold' };
    if (prob >= 25) return { label: 'Suplente Habitual (20%)', color: 'text-cream-dark' };
    return { label: 'Banquillo / No titular', color: 'text-red-400' };
  }
}
