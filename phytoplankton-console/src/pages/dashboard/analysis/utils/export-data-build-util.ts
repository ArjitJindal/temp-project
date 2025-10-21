import { orderBy } from 'lodash';
import { humanizeCamelCase } from '@flagright/lib/utils/humanize';
import { CsvRow, csvValue, serialize } from '@/utils/csv';

export interface ExportData {
  [key: string]: string | number | undefined;
}

export const exportDataForDonuts = (
  field: string,
  data: { name: string; value: number }[],
): string => {
  const parsedData = data.map((dataItem) => {
    return {
      [field]: dataItem.name,
      count: dataItem.value,
    };
  });
  return getCsvData(parsedData);
};

export const exportDataForTreemaps = (
  field: string,
  data: { name: string | null; value: number }[],
): string => {
  const parsedData = orderBy(data, 'value', 'desc').map((dataItem) => {
    return {
      [field]: dataItem.name ?? '',
      count: dataItem.value,
    };
  });
  return getCsvData(parsedData);
};

export const exportDataForBarGraphs = (
  data: { category: string | null; value: number; series?: string | number | null }[],
  xField: string,
  yField?: string,
  seriesLabel?: string,
  sortBy: string[] = ['time'],
  sortDir: ('desc' | 'asc')[] = ['desc'],
): string => {
  const parsedData = orderBy(data, sortBy, sortDir).map((dataItem) => {
    return seriesLabel === '' || seriesLabel === null
      ? {
          [xField]: dataItem.category ?? '',
          [yField ?? 'count']: dataItem.value,
        }
      : {
          [xField]: dataItem.category ?? '',
          [seriesLabel ?? '']: dataItem.series ?? '',
          [yField ?? 'count']: dataItem.value,
        };
  });
  return getCsvData(parsedData);
};

export const getCsvData = (data: ExportData[]): string => {
  if (data && data.length) {
    const result: CsvRow[] = [];
    const keys = Object.keys(data[0]).map((key) => key);
    result.push(
      keys.map((key) => {
        const humanizedKey = humanizeCamelCase(key);
        return csvValue(humanizedKey);
      }),
    );
    const rows = data.map((dataItem) => {
      return keys.map((key) => {
        return csvValue(dataItem[key]);
      });
    });
    rows.map((row) => {
      result.push(row);
    });
    return serialize(result);
  }
  return '';
};
