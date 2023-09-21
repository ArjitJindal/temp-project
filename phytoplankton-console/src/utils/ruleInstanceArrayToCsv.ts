import { flattenObject } from './json';
import { RuleInstance } from '@/apis';

export function arrayToCSV(data: RuleInstance[]) {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(flattenObject(data[0]));
  const csvRows: string[] = [];

  csvRows.push(headers.join(','));

  data.forEach((obj) => {
    const flatten = flattenObject(obj);
    const values = headers.map((header) => flatten[header]);
    csvRows.push(values.join(','));
  });
  return csvRows.join('\n');
}
