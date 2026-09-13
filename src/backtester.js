/**
 * Backtester Engine — Historical Calibration & Accuracy Verifier
 *
 * Evaluates performance of the expectation engine against historical Comunio matchday results.
 * Computes:
 * - MAE (Mean Absolute Error)
 * - RMSE (Root Mean Squared Error)
 * - Bias (Mean Signed Difference: positive = over-optimistic, negative = pessimistic)
 * - Calibration Error across predicted score deciles/bins
 */

export class Backtester {
  constructor(engine = null) {
    this.engine = engine;
  }

  /**
   * Evaluates accuracy metrics from paired arrays of predictions and actual outcomes.
   *
   * @param {Array<{ predicted: number, actual: number, name?: string, position?: string }>} records
   * @returns {{ count: number, mae: number, rmse: number, bias: number, ece: number, bins: Array }}
   */
  evaluateRecords(records = []) {
    const valid = (records || []).filter(
      r => typeof r.predicted === 'number' && !isNaN(r.predicted) && typeof r.actual === 'number' && !isNaN(r.actual)
    );

    const n = valid.length;
    if (n === 0) {
      return { count: 0, mae: 0, rmse: 0, bias: 0, ece: 0, bins: [] };
    }

    let sumAbsErr = 0;
    let sumSqErr = 0;
    let sumDiff = 0;

    valid.forEach(r => {
      const diff = r.predicted - r.actual;
      sumAbsErr += Math.abs(diff);
      sumSqErr += diff * diff;
      sumDiff += diff;
    });

    const mae = parseFloat((sumAbsErr / n).toFixed(3));
    const rmse = parseFloat(Math.sqrt(sumSqErr / n).toFixed(3));
    const bias = parseFloat((sumDiff / n).toFixed(3));

    // Calibration error across 5 score bins (<2, [2,4), [4,6), [6,8), >=8)
    const binDefinitions = [
      { name: '0-2 pts', min: 0, max: 2 },
      { name: '2-4 pts', min: 2, max: 4 },
      { name: '4-6 pts', min: 4, max: 6 },
      { name: '6-8 pts', min: 6, max: 8 },
      { name: '8+ pts', min: 8, max: Infinity }
    ];

    const bins = binDefinitions.map(b => {
      const inBin = valid.filter(r => r.predicted >= b.min && r.predicted < b.max);
      const binN = inBin.length;
      if (binN === 0) {
        return { ...b, count: 0, meanPredicted: 0, meanActual: 0, binError: 0 };
      }
      const meanPred = inBin.reduce((acc, r) => acc + r.predicted, 0) / binN;
      const meanAct = inBin.reduce((acc, r) => acc + r.actual, 0) / binN;
      const binError = Math.abs(meanPred - meanAct);

      return {
        ...b,
        count: binN,
        meanPredicted: parseFloat(meanPred.toFixed(2)),
        meanActual: parseFloat(meanAct.toFixed(2)),
        binError: parseFloat(binError.toFixed(3))
      };
    });

    // Expected Calibration Error weighted by bin sample size
    const ece = parseFloat(
      (bins.reduce((acc, b) => acc + (b.count / n) * b.binError, 0)).toFixed(3)
    );

    return {
      count: n,
      mae,
      rmse,
      bias,
      ece,
      bins
    };
  }

  /**
   * Backtest engine predictions on a historical dataset of player match logs.
   *
   * @param {Array<{ player: Object, actualScore: number, matchData?: Object }>} historicalMatches
   * @returns {{ count: number, mae: number, rmse: number, bias: number, ece: number, bins: Array, details: Array }}
   */
  backtestMatches(historicalMatches = []) {
    if (!this.engine) {
      throw new Error('ComunioEngine instance required for backtestMatches');
    }

    const records = historicalMatches.map(item => {
      const predicted = this.engine.getExpectedPoints(item.player, item.matchData);
      return {
        name: item.player?.name || 'Unknown',
        position: item.player?.position || 'mid',
        predicted,
        actual: item.actualScore
      };
    });

    const metrics = this.evaluateRecords(records);
    return {
      ...metrics,
      details: records
    };
  }
}
