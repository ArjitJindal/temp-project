import { download } from './browser';
import { ExportData } from './data-export';
import { message } from '@/components/library/Message';
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

/*
  Exporting
*/
export function transformCSVTableRows(data: ExportData): CsvRow[] {
  const result: CsvRow[] = [];
  result.push(data.headers.map((title) => csvValue(title)));

  for (const row of data.rows) {
    const csvRow: CsvValue[] = [];
    for (const { value, link } of row) {
      csvRow.push(csvValue(value));
      if (link) {
        csvRow.push(csvValue(link ? `${getCurrentDomain()}${link}` : ''));
      }
    }
    result.push(csvRow);
  }

  return result;
}

export async function downloadAsCSV(data: ExportData) {
  const rows = transformCSVTableRows(data);

  const fileName = `table_data_${new Date().toISOString().replace(/[^\dA-Za-z]/g, '_')}.csv`;
  message.success(`Data export finished`, { details: 'Download should start in a moment' });
  download(fileName, serialize(rows));
}
