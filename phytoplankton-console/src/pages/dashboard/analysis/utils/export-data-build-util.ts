import { orderBy } from 'lodash';
import { humanizeCamelCase } from '@flagright/lib/utils/humanize';
import { CsvRow, csvValue, serialize } from '@/utils/csv';

export interface ExportData {
  [key: string]: string | number | undefined;
}

export const exportDataForDonuts = (
  field: string,
  data: { series: string; value: number }[],
): string => {
  const parsedData = data.map((dataItem) => {
    return {
      [field]: dataItem.series,
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
  data: { xValue: string | null; yValue: number; series?: string | number | null }[],
  xField: string,
  yField?: string,
  seriesLabel?: string,
): string => {
  const parsedData = orderBy(data, 'value', 'desc').map((dataItem) => {
    return seriesLabel === '' || seriesLabel === null
      ? {
          [xField]: dataItem.xValue ?? '',
          [yField ?? 'count']: dataItem.yValue,
        }
      : {
          [xField]: dataItem.xValue ?? '',
          [seriesLabel ?? '']: dataItem.series ?? '',
          [yField ?? 'count']: dataItem.yValue,
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
