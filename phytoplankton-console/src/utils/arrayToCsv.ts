import { flattenObject } from './json';
import {
  DashboardStatsHitsPerUserData,
  InternalBusinessUser,
  InternalConsumerUser,
  RuleInstance,
} from '@/apis';

type arrayTypes =
  | InternalBusinessUser[]
  | InternalConsumerUser[]
  | DashboardStatsHitsPerUserData[]
  | RuleInstance[];

export function arrayToCSV(data: arrayTypes): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(flattenObject(data[0]));
  const csvRows: string[] = [];

  csvRows.push(headers.join(','));

  data.forEach((obj: any) => {
    const flatten = flattenObject(obj);
    const values = headers.map((header) => flatten[header]);
    csvRows.push(values.join(','));
  });
  return csvRows.join('\n');
}
