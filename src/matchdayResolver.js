/**
 * Matchday Resolver — Single source of truth for current and remaining matchdays.
 *
 * Priority order for resolution:
 * 1. Comunio API / Live Matchday Metadata (if client or live API data provided)
 * 2. web/src/data/matches.json (nextMatch.matchday)
 * 3. web/src/data/news.json / rivalsAudit.json (latest scoring matchday events)
 * 4. config.json (strategy.season.currentMatchday)
 * 5. Calendar-based fallback heuristic
 */

import fs from 'fs';
import path from 'path';

export const TOTAL_SEASON_MATCHDAYS = 38;

function createMatchdayResult(currentMatchday, source) {
  const cd = Math.min(TOTAL_SEASON_MATCHDAYS, Math.max(1, Math.round(currentMatchday)));
  const obj = {
    currentMatchday: cd,
    remainingMatchdays: Math.max(0, TOTAL_SEASON_MATCHDAYS - cd),
    source,
    totalMatchdays: TOTAL_SEASON_MATCHDAYS,
    valueOf() { return this.currentMatchday; },
    toString() { return String(this.currentMatchday); }
  };
  return obj;
}

/**
 * Resolves current matchday (1 to 38).
 *
 * @param {Object|null} liveContext Optional live context (client, apiData, or explicit override)
 * @returns {{ currentMatchday: number, remainingMatchdays: number, source: string, totalMatchdays: number }}
 */
export function resolveCurrentMatchday(liveContext = null) {
  // 0. Explicit numeric override
  if (typeof liveContext === 'number' && liveContext >= 1 && liveContext <= TOTAL_SEASON_MATCHDAYS) {
    return createMatchdayResult(liveContext, 'EXPLICIT_OVERRIDE');
  }

  // 1. Live Context metadata if provided
  if (liveContext?.currentMatchday && typeof liveContext.currentMatchday === 'number') {
    return createMatchdayResult(liveContext.currentMatchday, 'LIVE_METADATA');
  }

  // 2. matches.json
  try {
    const matchesPath = path.resolve('web/src/data/matches.json');
    if (fs.existsSync(matchesPath)) {
      const data = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
      const rawMd = data.nextMatch?.matchday;
      if (rawMd) {
        const nextMdNum = parseInt(String(rawMd).replace(/\D/g, ''), 10);
        if (!isNaN(nextMdNum) && nextMdNum >= 2 && nextMdNum <= 39) {
          // If next match is Matchday 6, currently completed matchdays is 5
          return createMatchdayResult(nextMdNum - 1, 'MATCHES_JSON');
        }
      }
    }
  } catch (e) {}

  // 3. news.json / rivalsAudit.json scoring events
  try {
    const newsPath = path.resolve('web/src/data/news.json');
    if (fs.existsSync(newsPath)) {
      const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
      if (Array.isArray(news)) {
        for (const item of news) {
          const text = ((item.title || '') + ' ' + (item.body || '')).toLowerCase();
          const match = text.match(/jornada\s*(\d+)/i) || text.match(/j(\d+)/i);
          if (match && match[1]) {
            const mdNum = parseInt(match[1], 10);
            if (!isNaN(mdNum) && mdNum >= 1 && mdNum <= 38) {
              return createMatchdayResult(mdNum, 'NEWS_SCORING_EVENT');
            }
          }
        }
      }
    }
  } catch (e) {}

  // 4. config.json
  try {
    const configPath = path.resolve('config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const configuredMd = cfg.strategy?.season?.currentMatchday;
      if (typeof configuredMd === 'number' && configuredMd >= 1 && configuredMd <= TOTAL_SEASON_MATCHDAYS) {
        return createMatchdayResult(configuredMd, 'CONFIG_FALLBACK');
      }
    }
  } catch (e) {}

  // 5. Calendar heuristic fallback (LaLiga season calendar August - May)
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0=Jan ... 7=Aug, 8=Sep, 11=Dec
  const day = now.getDate();
  let estimatedMd = 5; // Safe default for September

  if (month === 7) { // August (J1 - J3)
    estimatedMd = Math.min(3, Math.max(1, Math.floor((day - 10) / 7) + 1));
  } else if (month >= 8 && month <= 11) { // Sept - Dec (J4 - J18)
    estimatedMd = Math.min(19, 3 + (month - 8) * 4 + Math.floor(day / 8));
  } else if (month >= 0 && month <= 4) { // Jan - May (J19 - J38)
    estimatedMd = Math.min(38, 19 + month * 4 + Math.floor(day / 8));
  } else {
    estimatedMd = 38;
  }

  return createMatchdayResult(estimatedMd, 'CALENDAR_HEURISTIC');
}
