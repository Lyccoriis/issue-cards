import type { NewTestGroup } from '@/types';

export interface TestParse {
  groups: NewTestGroup[];
  errors: string[];
}

const STEP = /^([A-Z]{1,2})(\d+)\s*[:.)]?\s+(.*)$/;
const GROUP = /^(?:[Gg]roup\s+|#+\s*)?([A-Z]{1,2})(?::\s*|\s{2,}|\t+)(.*)$/;
const GROUP_MARKED = /^(?:[Gg]roup\s+|#+\s*)([A-Z]{1,2})(?:[:\s]\s*)(.*)$/;
const GROUP_ALONE = /^(?:(?:[Gg]roup\s+|#+\s*)([A-Z]{1,2}):?|([A-Z]{1,2}):)$/;
const SETUP = /^setup\s*:\s*(.*)$/i;

type Field = 'title' | 'setup' | 'how' | 'expected';

export function parseTestList(text: string): TestParse {
  const groups: NewTestGroup[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let group: NewTestGroup | null = null;
  let field: Field | null = null;

  function append(value: string): void {
    if (!group || !field) return;
    const step = group.steps[group.steps.length - 1];
    if (field === 'title') group.title = join(group.title, value);
    else if (field === 'setup') group.setup = join(group.setup, value);
    else if (step && field === 'how') step.how = join(step.how, value);
    else if (step && field === 'expected') step.expected = join(step.expected, value);
  }

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    const at = `line ${index + 1}`;

    const step = STEP.exec(line);
    if (step) {
      const letter = step[1];
      const num = Number(step[2]);
      const code = `${letter}${num}`;
      if (!group) {
        errors.push(`${at}: ${code} comes before any group`);
        continue;
      }
      if (letter !== group.letter) {
        errors.push(`${at}: ${code} sits under group ${group.letter}`);
        continue;
      }
      if (num < 1) {
        errors.push(`${at}: step numbers start at 1`);
        continue;
      }
      if (seen.has(code)) {
        errors.push(`${at}: ${code} is written twice`);
        continue;
      }
      seen.add(code);
      const cut = step[3].indexOf('|');
      group.steps.push({
        num,
        how: (cut < 0 ? step[3] : step[3].slice(0, cut)).trim(),
        expected: cut < 0 ? '' : step[3].slice(cut + 1).trim(),
      });
      field = cut < 0 ? 'how' : 'expected';
      continue;
    }

    const head = GROUP_MARKED.exec(line) ?? GROUP.exec(line) ?? GROUP_ALONE.exec(line);
    if (head) {
      const letter = head[1] ?? head[2];
      if (groups.some(g => g.letter === letter)) {
        errors.push(`${at}: group ${letter} is written twice`);
        group = null;
        field = null;
        continue;
      }
      group = { letter, title: (head[2] ?? '').trim(), setup: '', steps: [] };
      groups.push(group);
      field = 'title';
      continue;
    }

    const setup = SETUP.exec(line);
    if (setup && group) {
      group.setup = setup[1].trim();
      field = 'setup';
      continue;
    }

    if (!group) {
      errors.push(`${at}: text before the first group`);
      continue;
    }
    const last = group.steps[group.steps.length - 1];
    if (field === 'how' && last && line.includes('|')) {
      const cut = line.indexOf('|');
      last.how = join(last.how, line.slice(0, cut).trim());
      last.expected = line.slice(cut + 1).trim();
      field = 'expected';
      continue;
    }
    append(line);
  }

  for (const g of groups) {
    if (g.steps.length === 0) errors.push(`Group ${g.letter} has no steps`);
    for (const s of g.steps) {
      if (!s.how) errors.push(`${g.letter}${s.num} has no steps to run`);
      else if (!s.expected) errors.push(`${g.letter}${s.num} has no expected result, put it after a |`);
    }
  }
  if (groups.length === 0 && errors.length === 0) errors.push('Nothing to read, start with a group such as "A  Boarding"');

  return { groups, errors };
}

export function formatTestList(groups: NewTestGroup[]): string {
  return groups
    .map(g => {
      const lines = [g.title ? `${g.letter}  ${g.title}` : `${g.letter}:`];
      if (g.setup) lines.push(`setup: ${g.setup}`);
      for (const s of g.steps) lines.push(`${g.letter}${s.num}  ${s.how} | ${s.expected}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

export interface ImportedFeature {
  title: string;
  version: string;
  done: string;
  list: string;
}

const FILE_HEADINGS = ['NAME', 'VERSION', 'WHAT WAS DONE', 'WHAT TO TEST'] as const;

export function parseFeatureFile(text: string): { feature: ImportedFeature; errors: string[] } {
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const found: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of lines) {
    const heading = FILE_HEADINGS.find(h => h === line.trim());
    if (heading && !(heading in found)) {
      current = heading;
      found[heading] = [];
    } else if (current) {
      found[current].push(line);
    }
  }

  const part = (name: string) => (found[name] ?? []).join('\n').trim();
  const errors = FILE_HEADINGS.filter(h => !(h in found)).map(h => `The file has no ${h} section`);

  return {
    feature: {
      title: part('NAME'),
      version: part('VERSION'),
      done: part('WHAT WAS DONE'),
      list: part('WHAT TO TEST'),
    },
    errors,
  };
}

function join(current: string, more: string): string {
  return current ? `${current}\n${more}` : more;
}
