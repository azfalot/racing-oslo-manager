/** The only permitted automatic lineup-save window: 15–30 minutes before kickoff. */
export function isWithinPreMatchdayWindow(diffMinutes, minWindow = 15, maxWindow = 30) {
  return Number.isFinite(diffMinutes) && diffMinutes >= minWindow && diffMinutes <= maxWindow;
}
