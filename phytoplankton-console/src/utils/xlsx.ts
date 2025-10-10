import { CellObject, CellStyle } from 'xlsx-js-style';
import { ExportData } from './data-export';
import { getCurrentDomain } from './routing';
import { dayjs } from '@/utils/dayjs';

const EXCEL_CHAR_LIMIT = Math.pow(2, 15) - 1;

export function xlsxValue(value: unknown): string {
  if (value === null || value === '' || value === undefined) {
    return '-';
  }

  let str: string;

  if (typeof value === 'number' || typeof value === 'boolean') {
    str = value.toString();
  } else if (typeof value === 'string') {
    if (value.trim() === '' || value.trim() === '""') {
      return '-';
    }
    str = value;
  } else if (Array.isArray(value)) {
    str = value.join(', ');
  } else {
    str = JSON.stringify(value);
  }

  str = str.replace(/"/g, '');

  if (str.length > EXCEL_CHAR_LIMIT) {
    const label = '... (TRUNCATED)';
    str = str.substring(0, EXCEL_CHAR_LIMIT - label.length) + label;
  }
  return str;
}

export function transformXLSXTableRows(data: ExportData) {
  const columnTitles: string[] = data.headers;

  const style: CellStyle = {
    font: {
      bold: true,
    },
  };

  const rows: CellObject[][] = [];

  const timestampRow: CellObject[] = [
    {
      t: 's',
      v: 'Timestamp',
      s: style,
    },
    {
      t: 's',
      v: dayjs().format('MM/DD/YYYY, HH:mm:ss'),
    },
  ];
  rows.push(timestampRow);

  const emptyRow: CellObject[] = [];
  for (let i = 0; i < columnTitles.length; i++) {
    emptyRow.push({
      t: 's',
      v: '',
    });
  }

  rows.push(
    columnTitles.map((title) => ({
      t: 's',
      v: title,
      s: style,
    })),
  );

  const dataRows = data.rows.map((row) => {
    const rowData: CellObject[] = [];
    for (const { value, link } of row) {
      rowData.push({
        t: 's',
        v: xlsxValue(value),
      });

      if (link) {
        rowData.push({
          t: 's',
          v: link ? `${getCurrentDomain()}${link}` : '',
        });
      }
    }
    return rowData;
  });

  rows.push(...dataRows);

  return rows;
}

export async function downloadAsXLSX(data: ExportData) {
  const lib = await import('xlsx-js-style');
  const { utils, writeFile } = lib.default;
  const rows = transformXLSXTableRows(data);
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet(rows);

  utils.book_append_sheet(wb, ws, 'data_sheet');
  writeFile(wb, `table_data_${new Date().toISOString().replace(/[^\dA-Za-z]/g, '_')}.xlsx`);
}
