export const MAXIMUM_EXPORT_ITEMS = 100000;

export interface ExportValue {
  value: string | number | boolean | null;
  link?: string;
}

export type ExportDataRow = ExportValue[];

export type ExportData = {
  headers: string[];
  rows: ExportDataRow[];
};

export function exportValue(value: string | number | boolean | null, link?: string): ExportValue {
  return { value, link };
}
