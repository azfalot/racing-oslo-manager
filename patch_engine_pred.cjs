const fs = require('fs');

let c = fs.readFileSync('src/engine.js', 'utf8');

if (!c.includes('getMatchdayPrediction')) {
  const method = `
  /**
   * Calcula la predicción estimada de puntos para la próxima jornada del 11 titular.
   */
  getMatchdayPrediction(starting11) {
    if (!starting11 || starting11.length === 0) return 0;
    let total = 0;
    for (const p of starting11) {
      let avg = parseFloat(p.average?.points ? String(p.average.points).replace(',', '.') : 0);
      if (isNaN(avg) || avg <= 0) {
        if (p.expectedPoints && p.expectedPoints > 15) {
          avg = p.expectedPoints / 10;
        } else if (p.expectedPoints && p.expectedPoints > 0) {
          avg = p.expectedPoints;
        } else {
          avg = 4.2; // Baseline por jugador titular
        }
      }
      total += avg;
    }
    return Math.round(total);
  }
`;

  c = c.replace("export class ComunioEngine {", "export class ComunioEngine {\n" + method);
  fs.writeFileSync('src/engine.js', c);
}
