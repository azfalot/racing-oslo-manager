const fs = require('fs');

let c = fs.readFileSync('src/engine.js', 'utf8');

const oldFunc = `  getExpectedPoints(player) {
    // 1. Intentar usar puntos de esta temporada
    const currentPoints = parseInt(player.totalPoints);
    if (!isNaN(currentPoints) && currentPoints > 0) {
      return currentPoints;
    }

    // 2. Intentar usar promedio de puntos
    const avgPoints = parseFloat(player.average?.points);
    if (!isNaN(avgPoints) && avgPoints > 0) {
      return avgPoints * 10; // Escalar aproximando a 10 partidos
    }

    // 3. Usar histórico de temporadas anteriores
    if (player.historical && player.historical.length > 0) {
      // Ordenar por temporada descendente para coger la más reciente
      const history = [...player.historical].sort((a, b) => b.season.localeCompare(a.season));
      const lastSeasonPoints = parseInt(history[0].points);
      if (!isNaN(lastSeasonPoints) && lastSeasonPoints > 0) {
        return lastSeasonPoints;
      }
    }

    // 4. Puntuación por defecto si no hay datos
    return 10; 
  }`;

const newFunc = `  getExpectedPoints(player) {
    // 1. Intentar usar promedio por partido de esta temporada (si hay jornadas disputadas)
    let avgPoints = parseFloat(player.average?.points ? String(player.average.points).replace(',', '.') : 0);
    if (!isNaN(avgPoints) && avgPoints > 0) {
      return avgPoints * 10;
    }

    // 2. Usar histórico de temporadas anteriores (soporta array directo o player.historical.points)
    const historyList = Array.isArray(player.historical)
      ? player.historical
      : (player.historical?.points || []);

    if (historyList.length > 0) {
      const history = [...historyList].sort((a, b) => b.season.localeCompare(a.season));
      const lastSeasonPoints = parseInt(history[0].points);
      if (!isNaN(lastSeasonPoints) && lastSeasonPoints > 0) {
        return lastSeasonPoints;
      }
    }

    // 3. Puntos totales acumulados de la temporada actual
    const currentPoints = parseInt(player.totalPoints);
    if (!isNaN(currentPoints) && currentPoints > 0) {
      return currentPoints * 5;
    }

    // 4. Puntuación baseline por defecto
    return 10;
  }`;

if (c.includes('player.historical.length > 0')) {
  c = c.replace(oldFunc, newFunc);
  fs.writeFileSync('src/engine.js', c);
}
