export interface CsvValue {
  escaped: string;
}

export type CsvRow = CsvValue[];

export function csvValue(value: unknown): CsvValue {
  let str;
  if (value == null) {
    str = '';
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = `${value}`;
  } else if (typeof value === 'string') {
    str = `"${value.replace(/"/g, '""')}"`;
  } else {
    str = `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  return { escaped: str };
}

export function serialize(rows: CsvRow[]): string {
  return rows.map((row) => row.map(({ escaped }) => escaped).join(',')).join('\n');
}
