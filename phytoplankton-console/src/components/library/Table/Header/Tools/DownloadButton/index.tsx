import React, { useEffect, useState } from 'react';
import { get } from 'lodash';
import { message, Popover, Radio } from 'antd';
import * as XLSX from 'xlsx-js-style';
import {
  AllParams,
  applyFieldAccessor,
  DerivedColumn,
  FieldAccessor,
  isDerivedColumn,
  isGroupColumn,
  isSimpleColumn,
  SimpleColumn,
  TableColumn,
  TableData,
} from '../../../types';
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGINATION_ENABLED } from '../../../consts';
import s from './styles.module.less';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import Button from '@/components/library/Button';
import { flatDataItems } from '@/components/library/Table/internal/helpers';
import { download } from '@/utils/browser';
import * as Form from '@/components/ui/Form';
import { getErrorMessage } from '@/utils/lang';
import { CsvRow, CsvValue, csvValue, serialize } from '@/utils/csv';
import { PaginationParams } from '@/utils/queries/hooks';
import { UNKNOWN } from '@/components/library/Table/standardDataTypes';
import { xlsxValue } from '@/utils/xlsx';
import { getCurrentDomain } from '@/utils/routing';
import Alert from '@/components/library/Alert';

const MAXIMUM_EXPORT_ITEMS = 25000;

type Props<Item extends object, Params extends object> = {
  onPaginateData: (params: PaginationParams) => Promise<TableData<Item>>;
  columns: TableColumn<Item>[];
  params: AllParams<Params>;
  cursorPagination?: boolean;
  totalPages?: number;
};

export function transformCSVTableRows<T extends object>(
  items: T[],
  columnsToExport: (SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>)[],
  props: Props<T, any>,
): CsvRow[] {
  const result: CsvRow[] = [];

  result.push(
    columnsToExport.map((adjustedColumn) => csvValue(getColumnTitile(adjustedColumn, props))),
  );

  for (const row of items) {
    const csvRow = columnsToExport.map((column): CsvValue => {
      const columnDataType = { ...UNKNOWN, ...column.type };
      const value = isSimpleColumn(column)
        ? applyFieldAccessor(row, column.key)
        : column.value(row);

      return csvValue(
        columnDataType.stringify?.(value as any, row),
        columnDataType.link?.(value as any, row),
      );
    });
    result.push(csvRow);
  }

  return result;
}

function processTableCSVDownload<T extends object>(
  items: T[],
  columnsToExport: (SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>)[],
  props: Props<T, any>,
) {
  const rows = transformCSVTableRows(items, columnsToExport, props);

  const fileName = `table_data_${new Date().toISOString().replace(/[^\dA-Za-z]/g, '_')}.csv`;
  message.success(`Data export finished, downloading should start in a moment!`);
  download(fileName, serialize(rows));
}

export function transformXLSXTableRows<T extends object>(
  items: T[],
  columnsToExport: (SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>)[],
  props: Props<T, any>,
) {
  const columnTitles = columnsToExport.map((adjustedColumn) =>
    getColumnTitile(adjustedColumn, props),
  );

  const style: XLSX.CellStyle = {
    font: {
      bold: true,
    },
  };

  const rows: XLSX.CellObject[][] = [
    columnTitles.map((title) => ({
      t: 's',
      v: title,
      s: style,
    })),
  ];

  const dataRows = items.map((row) =>
    columnsToExport.map((column): XLSX.CellObject => {
      const columnDataType = { ...UNKNOWN, ...column.type };
      const value = isSimpleColumn(column)
        ? applyFieldAccessor(row, column.key)
        : column.value(row);
      const link = columnDataType.link?.(value as any, row);

      if (link) {
        return {
          t: 's',
          v: xlsxValue(columnDataType.stringify?.(value as any, row)),
          l: {
            Target: `${getCurrentDomain()}${link}`,
            Tooltip: columnDataType.stringify?.(value as any, row),
          },
        };
      }

      return {
        t: 's',
        v: xlsxValue(columnDataType.stringify?.(value as any, row)),
      };
    }),
  );

  rows.push(...dataRows);

  return rows;
}

function processTableExcelDownload<T extends object>(
  items: T[],
  columnsToExport: (SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>)[],
  props: Props<T, any>,
) {
  const rows = transformXLSXTableRows(items, columnsToExport, props);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  XLSX.utils.book_append_sheet(wb, ws, 'data_sheet');
  XLSX.writeFile(wb, `table_data_${new Date().toISOString().replace(/[^\dA-Za-z]/g, '_')}.xlsx`);
}

export default function DownloadButton<T extends object, Params extends object>(
  props: Props<T, Params>,
) {
  const {
    columns,
    onPaginateData,
    params: {
      pageSize = DEFAULT_PAGE_SIZE,
      pagination = DEFAULT_PAGINATION_ENABLED,
      page: currentPage = 1,
    },
    totalPages = 1,
  } = props;

  const [pagesMode, setPagesMode] = useState<'ALL' | 'CURRENT' | 'UP_TO_10000'>('CURRENT');
  const [progress, setProgress] = useState<null | { page: number; totalPages?: number }>(null);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [isDownloadError, setIsDownloadError] = useState<boolean>(false);
  useEffect(() => {
    if (isDownloadError) {
      setPagesMode('UP_TO_10000');
    }
  }, [isDownloadError]);
  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result: CsvRow[] = [];

      const columnsToExport = prepareColumns(columns);
      result.push(
        columnsToExport.map((adjustedColumn) => csvValue(getColumnTitile(adjustedColumn, props))),
      );
      let totalPages = 1;
      let page = pagesMode === 'ALL' ? 1 : currentPage;

      // Params for cursor pagination.
      let from = '';
      let next = '';
      let runningTotal = 0;
      let cursorPaginated = false;
      const allFlatData: T[] = [];
      do {
        setProgress({
          page: pagesMode === 'CURRENT' ? 1 : page,
          totalPages: from ? undefined : totalPages,
        });
        const { total, items, next: nextCursor } = await onPaginateData({ from, page, pageSize });

        // If a cursor is returned, this is cursor paginated.
        cursorPaginated = nextCursor !== undefined;

        runningTotal += items.length;
        if (cursorPaginated && nextCursor) {
          next = nextCursor;
        }
        const totalItemsCount = total ?? items.length;
        if (
          pagesMode === 'ALL' &&
          (totalItemsCount > MAXIMUM_EXPORT_ITEMS || runningTotal > MAXIMUM_EXPORT_ITEMS)
        ) {
          message.error(
            `There is too much items to export (> ${MAXIMUM_EXPORT_ITEMS}). Try to change filters or export only current page.`,
          );
          setIsDownloadError(true);
          return;
        }

        const flatData = flatDataItems<T>(items);
        allFlatData.push(...flatData);
        if (pagesMode === 'CURRENT') {
          break;
        }
        totalPages = Math.ceil(totalItemsCount / pageSize);
        page++;

        if (cursorPaginated) {
          if (!next || next == '') {
            break;
          }
          if (from == next) {
            break;
          }
          from = next;
        }
      } while ((totalPages && page <= totalPages) || cursorPaginated);
      if (format === 'csv') {
        processTableCSVDownload(allFlatData, columnsToExport, props);
      } else {
        processTableExcelDownload(allFlatData, columnsToExport, props);
      }
    } catch (e) {
      message.error(`Unable to export data. ${getErrorMessage(e)}`);
      console.error(e);
    } finally {
      setProgress(null);
    }
  };

  const handleNonPaginatedDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const columnsToExport = prepareColumns(columns);

      const { total, items } = await onPaginateData({ pageSize });
      const totalItemsCount = total ?? items.length;
      if (totalItemsCount > MAXIMUM_EXPORT_ITEMS) {
        message.error(
          `There is too much items to export (> ${MAXIMUM_EXPORT_ITEMS}). Try to change filters or export only current page.`,
        );
        setIsDownloadError(true);
        return;
      }
      const flatData = flatDataItems<T>(items);

      if (format === 'csv') {
        processTableCSVDownload(flatData, columnsToExport, props);
      } else {
        processTableExcelDownload(flatData, columnsToExport, props);
      }
    } catch (e) {
      message.error(`Unable to export data. ${getErrorMessage(e)}`);
      console.error(e);
    } finally {
      setProgress(null);
    }
  };

  if (!pagination) {
    return (
      <div className={s.root} onClick={handleNonPaginatedDownload}>
        <DownloadLineIcon className={s.icon} />
      </div>
    );
  }

  return (
    <Popover
      placement="bottomRight"
      arrowPointAtCenter
      content={
        <form onSubmit={handleDownload}>
          <div className={s.form}>
            {(totalPages !== 1 || props.cursorPagination) && (
              <Form.Layout.Label title="Download data">
                <Radio.Group
                  onChange={(e) => {
                    setPagesMode(e.target.value);
                  }}
                  value={pagesMode}
                >
                  <Radio value="CURRENT" defaultChecked>
                    Current page
                  </Radio>
                  <Radio value="ALL">All pages</Radio>
                  {isDownloadError && <Radio value="UP_TO_10000">Upto 10,000 rows</Radio>}
                </Radio.Group>
              </Form.Layout.Label>
            )}
            {pagesMode === 'ALL' && (
              <Alert type="info">
                This option downloads up to 25,000 rows. Browser capacity may also impact the
                download.
              </Alert>
            )}
            {pagesMode === 'UP_TO_10000' && (
              <Alert type="error">
                Download failed for all pages due to browser capacity. Please try downloading for up
                to 10,000 rows.
              </Alert>
            )}
            <Form.Layout.Label title="Format">
              <Radio.Group
                onChange={(e) => {
                  setFormat(e.target.value);
                }}
                value={format}
              >
                <Radio value="csv" defaultChecked>
                  CSV
                </Radio>
                <Radio value="xlsx">XLSX</Radio>
              </Radio.Group>
            </Form.Layout.Label>
            <Button
              isDisabled={progress != null}
              htmlType="submit"
              type="PRIMARY"
              className={s.download}
            >
              {progress == null
                ? 'Download'
                : `Downloading (${progress.page}${
                    progress.totalPages ? `/${progress.totalPages}` : ''
                  })...`}
            </Button>
          </div>
        </form>
      }
      trigger="click"
    >
      <div className={s.root}>
        <DownloadLineIcon className={s.icon} />
      </div>
    </Popover>
  );
}

function prepareColumns<T extends object>(
  columns: TableColumn<T>[],
  prefix = '',
): (SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>)[] {
  const result: any[] = [];
  for (const column of columns) {
    const title = typeof column.title === 'string' ? column.title : '-';
    if (isGroupColumn(column)) {
      result.push(...prepareColumns(column.children, `${title} / `));
    } else if (
      (isSimpleColumn(column) || isDerivedColumn(column)) &&
      (column.exporting ?? column.hideInTable !== true)
    ) {
      result.push({
        ...column,
        title: prefix + title,
      });
    }
  }
  return result;
}

function getColumnTitile<T extends object>(column: TableColumn<T>, props: Props<T, any>) {
  let title = column.headerTitle;

  if (!title) {
    title = typeof column.title === 'string' ? column.title : '-';
  }

  const key = isSimpleColumn(column) ? column.key : column.id;
  const filterValue = key ? get(props.params, key) : null;
  if (filterValue) {
    let filterValueOptions = '';

    if (typeof filterValue === 'object' && Array.isArray(filterValue)) {
      filterValueOptions = filterValue.join(', ');
    } else if (typeof filterValue === 'string') {
      filterValueOptions = filterValue;
    } else if (typeof filterValue === 'number') {
      filterValueOptions = filterValue.toString();
    }

    title += ` (Filter: ${filterValueOptions})`?.trim();
  }
  return title;
}
