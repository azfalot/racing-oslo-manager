/**
 * Módulo de Seguimiento de Minutos y Ratio de Titularidad Real (LaLiga)
 */

export class MinuteTracker {
  /**
   * Estima los minutos promedio por partido jugados por un futbolista
   * basándose en datos de Comunio, Transfermarkt y jerarquía de plantilla.
   */
  static getEstimatedMinutesPerGame(player) {
    if (!player) return 45;

    const price = player.price || player.quotedprice || 0;
    const stats = player.stats || {};
    const name = (player.name || '').toLowerCase();
    
    // Fijos indiscutibles (80 - 90 min/partido)
    if (name.includes('valverde') || name.includes('soria') || name.includes('mandi') || name.includes('de la fuente') || name.includes('jon martín') || name.includes('gerard moreno') || name.includes('hugo duro')) {
      return 85;
    }
    
    // Titulares habituales / Carrileros con alto minutaje (65 - 80 min/partido)
    if (name.includes('galarreta') || name.includes('hugo álvarez') || name.includes('moi gómez')) {
      return 75;
    }

    // Rotación frecuente / Minutos compartidos (45 - 65 min/partido)
    if (name.includes('pablo durán') || name.includes('álvaro núñez')) {
      return 55;
    }

    // Suplentes residuales / Rodaje post-lesión (5 - 20 min/partido)
    if (name.includes('kike barja') || name.includes('marc santos') || name.includes('szczęsny')) {
      return 15;
    }

    // Heurística general para jugadores de mercado
    if (price > 12000000) return 85;
    if (price > 4000000) return 78;
    if (price > 1500000) return 65;
    if (price > 600000) return 50;
    if (price > 250000) return 25;
    return 15;
  }

  /**
   * Calcula el factor multiplicador de rendimiento basado en el minutaje real
   * y el porcentaje de titularidad.
   */
  static getMinuteMultiplier(player) {
    const mins = this.getEstimatedMinutesPerGame(player);

    if (mins >= 75) {
      // Titular indiscutible (75-90 min): rinde al 105% de su potencial
      return 1.05;
    } else if (mins >= 60) {
      // Titular habitual (60-74 min): rinde al 95%
      return 0.95;
    } else if (mins >= 40) {
      // Rotación / Primer cambio (40-59 min): rinde al 75%
      return 0.75;
    } else if (mins >= 20) {
      // Suplente revulsivo (20-39 min): rinde al 50%
      return 0.50;
    } else {
      // Suplente residual / Rodaje (0-19 min): rinde al 35% de su proyección
      return 0.35;
    }
  }
}
