export function parseStamp(time: string): number | null {
  if (!time) return null;
  const ms = Date.parse(time.trim().replace(' ', 'T'));
  return Number.isNaN(ms) ? null : ms;
}

const UNITS: [seconds: number, name: string][] = [
  [31_536_000, 'year'],
  [2_592_000, 'month'],
  [604_800, 'week'],
  [86_400, 'day'],
  [3_600, 'hour'],
  [60, 'minute'],
];

export function relTime(time: string): string {
  const ms = parseStamp(time);
  if (ms === null) return '';

  const secs = Math.round((Date.now() - ms) / 1000);
  if (secs < 60) return 'just now';

  for (const [size, name] of UNITS) {
    if (secs >= size) {
      const n = Math.floor(secs / size);
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}
