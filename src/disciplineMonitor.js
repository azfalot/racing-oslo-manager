/**
 * Módulo de Control Disciplinario y Ciclo de Tarjetas (RFEF & Comunio)
 * Normativa:
 * - Ciclo de 5 tarjetas amarillas (Art. 112 Código Disciplinario RFEF): 1 partido de suspensión a las 5, 10, 15, 20...
 * - 'En Capilla': 4, 9, 14, 19 tarjetas amarillas (a 1 amarilla de la suspensión).
 * - Tarjeta Roja Directa o Doble Amarilla: 1+ partidos de suspensión inmediata.
 */

export class DisciplineMonitor {
  /**
   * Analiza el estado disciplinario completo de un futbolista
   */
  static getDisciplinaryStatus(player) {
    if (!player) {
      return { yellows: 0, cycleYellows: 0, reds: 0, isSuspended: false, isWarning: false, label: 'Limpio' };
    }

    const cards = player.cards || {};
    const yellowCards = parseInt(cards.yellow || 0);
    const redCards = parseInt(cards.red || 0);
    const yellowRedCards = parseInt(cards.yellowRed || 0);

    const statusText = ((player.status || '') + ' ' + (player.statusInfo || '') + ' ' + (player.availability || '')).toLowerCase();

    // 1. Detección de suspensión activa por tarjeta roja o Comunio ban
    const hasActiveRed = redCards > 0 || yellowRedCards > 0 || statusText.includes('sancionado') || statusText.includes('suspended') || statusText.includes('banned');

    // 2. Ciclo de 5 tarjetas amarillas (RFEF)
    // Cada 5 amarillas completas (5, 10, 15) acarrean suspensión si aún no se ha cumplido
    const cyclePos = yellowCards % 5;
    const isFifthYellowBan = (yellowCards > 0 && cyclePos === 0);

    const isSuspended = hasActiveRed || isFifthYellowBan;
    const isWarning = !isSuspended && (cyclePos === 4); // 'En Capilla' (4/5, 9/10, etc.)

    let label = 'Limpio';
    let badgeClass = 'text-forest-light bg-forest/20';

    if (hasActiveRed) {
      label = '🟥 Sancionado por Tarjeta Roja';
      badgeClass = 'text-red-400 bg-red-500/20 border-red-500/30';
    } else if (isFifthYellowBan) {
      label = `🟨 Sancionado por Acumulación (${yellowCards} amarillas)`;
      badgeClass = 'text-red-400 bg-red-500/20 border-red-500/30';
    } else if (isWarning) {
      label = `⚠️ En Capilla (${yellowCards} amarillas - 4/5 ciclo)`;
      badgeClass = 'text-gold bg-gold/20 border-gold/30';
    } else if (yellowCards > 0) {
      label = `${yellowCards} ${yellowCards === 1 ? 'amarilla' : 'amarillas'} (${cyclePos}/5 ciclo)`;
      badgeClass = 'text-cream-dark bg-white/5';
    }

    return {
      yellows: yellowCards,
      cycleYellows: cyclePos,
      reds: redCards + yellowRedCards,
      isSuspended,
      isWarning,
      label,
      badgeClass
    };
  }

  /**
   * Determina si el jugador debe ser excluido del Once por sanción
   */
  static isPlayerSuspended(player) {
    const status = this.getDisciplinaryStatus(player);
    return status.isSuspended;
  }
}
