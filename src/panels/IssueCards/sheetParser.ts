import type { IssuePriority, IssueStatus } from '@/types';

export interface SheetRow {
  sheetRef: string;
  title: string;
  description: string;
  type: string;
  priority: IssuePriority;
  status: IssueStatus;
  version: string;
  tags: string[];
  media: string;
  notes: string[];
  testProcedure: string;
  section: string;
}

export interface SheetParse {
  rows: SheetRow[];
  skipped: { ref: string; reason: string }[];
}

const TITLE_MAX = 90;

const VERSION_LABEL = /^version\s*n?\s*([\d.]+)/i;
const NO_MEDIA = /^no\s*media$/i;

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleFrom(description: string): string {
  const flat = description.replace(/\s+/g, ' ').trim();
  if (flat.length <= TITLE_MAX) return flat;
  const cut = flat.slice(0, TITLE_MAX - 3);
  const space = cut.lastIndexOf(' ');
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

function priorityFrom(raw: string): IssuePriority {
  const v = raw.toLowerCase();
  if (v.includes('high')) return 'high';
  if (v.includes('low')) return 'low';
  return 'medium';
}

function typeFrom(resolution: string): string {
  const v = resolution.toLowerCase();
  if (v.includes('add')) return 'Feature';
  if (v.includes('change')) return 'Change';
  return 'Bug';
}

function statusFrom(resolution: string, verified: string): IssueStatus {
  const res = resolution.toLowerCase();
  const ver = verified.trim();
  if (res.includes('denied')) return 'wontfix';
  if (res === 'fixed') {
    if (ver.startsWith('5')) return 'resolved';
    if (ver.startsWith('6')) return 'fixed';
  }
  return 'open';
}

function verifyTag(verified: string): string {
  const v = verified.trim();
  if (v.startsWith('5')) return 'verify:yes';
  if (v.startsWith('4')) return 'verify:regression';
  if (v.startsWith('3')) return 'verify:partial';
  if (v.startsWith('2')) return 'verify:no-regression';
  if (v.startsWith('1')) return 'verify:no';
  return 'verify:unchecked';
}

function splitColumns(line: string): string[] {
  const cols = line.split('\t');
  if (cols.length >= 6) return cols;
  return line.split(/ {2,}/);
}

function splitNotes(text: string): { body: string; notes: string[] } {
  const parts = text.split(/\s*<-\s*/);
  return {
    body: parts[0].trim(),
    notes: parts.slice(1).map(n => n.trim()).filter(Boolean),
  };
}

export function parseSheet(raw: string): SheetParse {
  const rows: SheetRow[] = [];
  const skipped: { ref: string; reason: string }[] = [];

  let section = '';
  let version = '';

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const cols = splitColumns(line);
    const filled = cols.filter(c => c.trim()).length;
    if (filled === 0) continue;

    const ref = cols[0].trim();

    if (!ref.startsWith('#')) {
      if (filled > 1) continue;
      const versionLabel = VERSION_LABEL.exec(ref);
      if (versionLabel) {
        version = versionLabel[1];
      } else {
        version = '';
      }
      section = ref;
      continue;
    }

    const description = (cols[5] ?? '').trim();
    if (!description) continue;

    if (cols.length < 6) {
      skipped.push({ ref, reason: 'could not split the row into six columns' });
      continue;
    }

    const media = (cols[1] ?? '').trim();
    const resolution = (cols[2] ?? '').trim();
    const verified = (cols[3] ?? '').trim();

    const body = splitNotes(description);
    const trailing = cols
      .slice(6)
      .map(cell => cell.replace(/^\s*<-\s*/, '').trim())
      .filter(Boolean);

    const status = statusFrom(resolution, verified);
    const tags = [`sheet:${slug(resolution)}`, verifyTag(verified)];
    if (/legacy/i.test(section)) tags.push('sheet:legacy');

    rows.push({
      sheetRef: ref,
      title: titleFrom(body.body),
      description: body.body,
      type: typeFrom(resolution),
      priority: priorityFrom((cols[4] ?? '').trim()),
      status,
      version,
      tags,
      media: media && !NO_MEDIA.test(media) ? media : '',
      notes: [...body.notes, ...trailing],
      testProcedure:
        status === 'fixed' || status === 'resolved'
          ? `From the shared bug sheet, ref ${ref}, marked ${resolution} / ${verified}. ` +
            'Reproduce the description on the current build and confirm the behavior is gone.'
          : '',
      section,
    });
  }

  return { rows, skipped };
}
