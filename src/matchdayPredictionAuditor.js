import fs from 'fs';
import path from 'path';
import { publishMatchdayPreviewNews, publishClubNews } from './imageGen.js';

const PREDICTIONS_FILE = 'matchday_predictions.json';

/**
 * Carga el historial de predicciones
 */
function loadPredictions() {
  if (fs.existsSync(PREDICTIONS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PREDICTIONS_FILE, 'utf-8'));
    } catch (e) {}
  }
  return {};
}

/**
 * Guarda el historial de predicciones
 */
function savePredictions(data) {
  fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 1. PRE-JORNADA: Registra la predicción de puntos del 11 titular y publica noticia de previa
 */
export async function recordMatchdayPrediction(matchdayNumber, matchdayName, lineupResult) {
  try {
    const predictions = loadPredictions();
    const key = `matchday_${matchdayNumber}`;

    const starting11 = lineupResult.starting11 || [];
    const formation = lineupResult.formation || '4-4-2';
    
    // Normalizar puntos esperados para una sola jornada (si vienen anualizados > 30, dividir entre 38)
    const normalizedStarters = starting11.map(p => {
      const rawExp = p.expectedPoints || 0;
      const perMatch = rawExp > 30 ? Math.round(rawExp / 38) : rawExp;
      return {
        id: p.playerId || p.id,
        name: p.name,
        type: p.type || p.position,
        expectedPoints: perMatch
      };
    });

    const projectedPoints = normalizedStarters.reduce((sum, p) => sum + (p.expectedPoints || 0), 0);

    const predictionData = {
      matchday: matchdayNumber,
      matchdayName: matchdayName || `Jornada ${matchdayNumber}`,
      projectedPoints,
      formation,
      starting11: normalizedStarters,
      confirmedAt: new Date().toISOString(),
      resolved: false
    };

    predictions[key] = predictionData;
    savePredictions(predictions);

    console.log(`[PREDICTOR] 📊 Predicción registrada para ${predictionData.matchdayName}: ~${projectedPoints} pts.`);

    // Publicar Noticia Oficial de Previa con la estimación
    const title = `PREVIA & PRONÓSTICO: El Racing de Oslo proyecta ~${projectedPoints} pts para la ${predictionData.matchdayName}`;
    const summary = `Mateo Oslomany confirma el dibujo (${formation}) con una previsión técnica de ~${projectedPoints} puntos.`;
    
    let body = `La Secretaría Técnica del Racing de Oslo ha cerrado la alineación definitiva para afrontar la ${predictionData.matchdayName}.\n\n` +
      `📐 Dibujo Táctico: ${formation}\n` +
      `🎯 Pronóstico Estimado: ~${projectedPoints} puntos\n\n` +
      `🛡️ ONCE TITULAR Y EXPECTATIVAS DE RENDIMIENTO:\n`;
    
    starting11.forEach(p => {
      body += ` • ${p.name} (${p.type || 'MED'}): ~${p.expectedPoints || 0} pts esperados\n`;
    });

    body += `\nAl término de todos los encuentros, la Dirección Deportiva auditará el balance entre la estimación y los puntos reales obtenidos.`;

    await publishClubNews(title, summary, body, 'Previa', 'preview');

    return predictionData;
  } catch (err) {
    console.error('[PREDICTOR ERROR] Error registrando predicción de jornada:', err.message);
    return null;
  }
}

/**
 * 2. POST-JORNADA: Compara los puntos reales de los jugadores con la predicción y publica balance
 */
export async function auditMatchdayResults(matchdayNumber, realPointsEarned, squadPlayers = []) {
  try {
    const predictions = loadPredictions();
    const key = `matchday_${matchdayNumber}`;
    const prediction = predictions[key];

    if (!prediction || prediction.resolved) {
      return null;
    }

    const projected = prediction.projectedPoints || 0;
    const real = realPointsEarned || 0;
    const diff = real - projected;
    const diffText = diff >= 0 ? `+${diff} pts sobre lo estimado` : `${diff} pts por debajo de lo previsto`;
    const accuracyPct = projected > 0 ? Math.min(100, Math.round((Math.min(real, projected) / Math.max(real, projected)) * 100)) : 100;

    console.log(`[AUDIT JORNADA] 🏁 Balance Jornada ${matchdayNumber}: Real ${real} pts vs Estimado ${projected} pts (${diffText}, Precisión: ${accuracyPct}%)`);

    // Detalle por jugadores si están disponibles
    let playerBreakdown = '';
    if (squadPlayers && squadPlayers.length > 0 && prediction.starting11) {
      prediction.starting11.forEach(starter => {
        const found = squadPlayers.find(p => (p.id || p.playerId) === starter.id || p.name === starter.name);
        const actualPts = found?.lastPoints !== undefined ? found.lastPoints : (found?.points || '—');
        playerBreakdown += ` • ${starter.name}: ${actualPts} pts reales (Previsto: ~${starter.expectedPoints} pts)\n`;
      });
    }

    const title = `BALANCE OFICIAL: ${real} Puntos en la ${prediction.matchdayName} (${diffText})`;
    const summary = `Auditoría post-jornada: ${real} puntos obtenidos frente a los ~${projected} proyectados (Precisión: ${accuracyPct}%).`;
    
    let body = `Ha concluido oficialmente la ${prediction.matchdayName}. La Secretaría Técnica ha completado el informe de precisión y rendimiento:\n\n` +
      `📊 RESUMEN EJECUTIVO:\n` +
      ` • Puntos Reales Sumados: ${real} pts\n` +
      ` • Estimación Inicial: ~${projected} pts\n` +
      ` • Desviación: ${diffText}\n` +
      ` • Índice de Precisión del Modelo: ${accuracyPct}%\n\n`;

    if (playerBreakdown) {
      body += `⭐ RENDIMIENTO INDIVIDUAL DEL ONCE:\n${playerBreakdown}\n`;
    }

    body += `\n🧠 CONCLUSIONES DE LA SECRETARÍA TÉCNICA:\n` +
      (diff >= 0 
        ? `El rendimiento global superó las expectativas del modelo táctico. La plantilla respondió con alta efectividad en los duelos clave.`
        : `Algunas piezas clave estuvieron por debajo de su media histórica. Los parámetros dinámicos se recalibrarán para la siguiente jornada.`);

    await publishClubNews(title, summary, body, 'Crónica', 'chronicle');

    // Marcar como resuelta
    prediction.resolved = true;
    prediction.realPoints = real;
    prediction.diff = diff;
    prediction.accuracyPct = accuracyPct;
    prediction.resolvedAt = new Date().toISOString();
    predictions[key] = prediction;
    savePredictions(predictions);

    return {
      matchday: matchdayNumber,
      real,
      projected,
      diff,
      accuracyPct
    };
  } catch (err) {
    console.error('[AUDIT JORNADA ERROR] Error auditando resultado de jornada:', err.message);
    return null;
  }
}
