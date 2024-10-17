import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { QuestionResponse } from '../../../types';
import { typeAssigner } from '../HistoryItemTable';
import { CsvRow, csvValue, serialize } from '@/utils/csv';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { getComparisonItems } from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/SanctionsComparison';

export const formatData = (item: Partial<QuestionResponse>): string => {
  const result: CsvRow[] = [];
  if (!item.questionType) {
    return '';
  }
  switch (item.questionType) {
    case 'TABLE': {
      if (!item?.headers) {
        return '';
      }
      result.push(item.headers.map((header) => csvValue(header.name)));
      if (!item.rows) {
        break;
      }
      for (const row of item.rows) {
        const updatedRow: CsvRow = [];
        for (let index = 0; index < item.headers.length; index++) {
          const columnType = typeAssigner(item.headers[index].columnType ?? '');
          updatedRow.push(
            csvValue(
              columnType === undefined
                ? row[index]
                : columnType.stringify?.(row[index] as any, row) ?? row[index],
            ),
          );
        }
        result.push(updatedRow);
      }
      break;
    }
    case 'BARCHART': {
      if (!item.values) {
        break;
      }
      const rows = item.values.map((value) => [
        csvValue(value?.x ?? 'N/A'),
        csvValue(value?.y ?? 0),
      ]);
      result.push(...rows);
      break;
    }
    case 'TIME_SERIES': {
      if (!item.timeseries) {
        break;
      }
      for (const seriesItem of item.timeseries) {
        const rows =
          seriesItem.values
            ?.map((item): CsvRow => {
              return item.value
                ? [csvValue(dayjs(item.time).format(DEFAULT_DATE_FORMAT)), csvValue(item.value)]
                : [];
            })
            .filter((row) => !(row.length === 0)) ?? [];
        result.push(...rows);
      }
      break;
    }
    case 'PROPERTIES': {
      if (!item.properties) {
        break;
      }
      const rows = item.properties.map((property) => {
        return [csvValue(humanizeAuto(property.key || '')), csvValue(property.value)];
      });
      result.push(...rows);
      break;
    }
    case 'STACKED_BARCHART': {
      if (!item.series) {
        return '';
      }
      const header: CsvRow = item.series.map((seriesItem) => csvValue(seriesItem.label));
      result.push([csvValue(''), ...header]);
      const lookUp: { [key: string]: CsvRow } = {};
      for (const seriesItem of item.series) {
        for (const item of seriesItem.values ?? []) {
          if (item.x) {
            if (!lookUp[item.x]) {
              lookUp[item.x] = [];
            }
            lookUp[item.x ?? ''].push(csvValue(item.y));
          }
        }
      }
      const rows: CsvRow[] = Object.keys(lookUp).map((key) => {
        return [csvValue(key), ...lookUp[key]];
      });
      result.push(...rows);
      break;
    }
    case 'SCREENING_COMPARISON': {
      const { sanctionsHit } = item;
      const comparisonItems = getComparisonItems(
        sanctionsHit?.entity.matchTypeDetails || [],
        sanctionsHit?.hitContext || { entity: 'USER' },
      );
      const header: CsvRow = [
        csvValue('title'),
        csvValue('screeningValue'),
        csvValue('kycValue'),
        csvValue('match'),
        csvValue('sources'),
      ];
      result.push(header);
      for (const comparisonItem of comparisonItems) {
        result.push([
          csvValue(comparisonItem.title),
          csvValue(comparisonItem.screeningValue),
          csvValue(comparisonItem.kycValue),
          csvValue(comparisonItem.match),
          csvValue(comparisonItem.sources),
        ]);
      }
      break;
    }
    case 'EMBEDDED':
      break;
  }
  return serialize(result);
};
