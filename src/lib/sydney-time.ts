/**
 * Sydney-day helpers.
 *
 * The business runs on Sydney time, so "today" must mean the Sydney day, not the
 * UTC day the server happens to be in — otherwise the daily counters roll over at
 * 10-11am local and the morning's activity lands on the wrong day.
 *
 * Extracted from /api/analytics so /api/analytics/calls reports the same "today"
 * the dashboard tiles do; a second copy would be free to drift.
 */

export const TZ = 'Australia/Sydney'

/**
 * Sydney's UTC offset (ms) at a given instant. Read from Intl rather than
 * hardcoded so AEST/AEDT is handled without a DST table.
 */
export function tzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const wallClock = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  // Offsets are whole minutes; round away the sub-second noise from the two clocks.
  return Math.round((wallClock - at.getTime()) / 60_000) * 60_000
}

/** The instant of Sydney midnight for whatever Sydney day `at` falls in. */
export function dayStart(at: Date): Date {
  const offset = tzOffsetMs(at)
  const wallClock = new Date(at.getTime() + offset)
  const midnight = Date.UTC(
    wallClock.getUTCFullYear(),
    wallClock.getUTCMonth(),
    wallClock.getUTCDate(),
  )
  // Re-resolve the offset at the candidate midnight: on a DST boundary the offset
  // at `at` is not necessarily the offset that was in force at midnight.
  return new Date(midnight - tzOffsetMs(new Date(midnight - offset)))
}

/** Sydney calendar date as YYYY-MM-DD, for comparing against plain date columns. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
