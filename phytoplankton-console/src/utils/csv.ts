import { getCurrentDomain } from '@/utils/routing';

export interface CsvValue {
  escaped: string;
}

export type CsvRow = CsvValue[];

export function csvValue(value: unknown, link?: string): CsvValue {
  if (value === null || value === '' || value === undefined) {
    return { escaped: '"-"' };
  }

  let str: string;

  if (typeof value === 'number' || typeof value === 'boolean') {
    str = `"${value}"`;
  } else if (typeof value === 'string') {
    if (value.trim() === '' || value.trim() === '""') {
      return { escaped: '"-"' };
    }
    str = `"${value}"`;
  } else if (Array.isArray(value)) {
    str = `"${value.join(', ')}"`;
  } else {
    str = `"${JSON.stringify(value)}"`;
  }

  str = str.replace(/"/g, '');

  return { escaped: `"${str}${link ? ` (${getCurrentDomain()}${link})` : ''}"` };
}

export function serialize(rows: CsvRow[]): string {
  return rows.map((row) => row.map(({ escaped }) => escaped).join(',')).join('\n');
}
