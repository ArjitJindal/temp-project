import React, { useState } from 'react';
import _ from 'lodash';
import { message, Popover, Radio, Select } from 'antd';
import {
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

const MAXIMUM_EXPORT_ITEMS = 10000;

type Props<Item extends object> = {
  currentPage: number;
  onPaginateData: (params: PaginationParams) => Promise<TableData<Item>>;
  columns: TableColumn<Item>[];
  pageSize: number;
  pagination: boolean;
};

export default function DownloadButton<T extends object>(props: Props<T>) {
  const { currentPage, columns, onPaginateData, pageSize, pagination } = props;

  const [pagesMode, setPagesMode] = useState<'ALL' | 'CURRENT'>('ALL');
  const [progress, setProgress] = useState<null | { page: number; totalPages: number }>(null);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result: CsvRow[] = [];

      const columnsToExport = prepareColumns(columns);

      result.push(
        columnsToExport.map((adjustedColumn) =>
          csvValue(typeof adjustedColumn.title === 'string' ? adjustedColumn.title : '-'),
        ),
      );
      let totalPages = 1;
      let page = pagesMode === 'ALL' ? 1 : currentPage;
      do {
        setProgress({
          page: pagesMode === 'CURRENT' ? 1 : page,
          totalPages,
        });

        const { total, items } = await onPaginateData({ page, pageSize });
        const totalItemsCount = total ?? items.length;
        if (pagesMode === 'ALL' && totalItemsCount > MAXIMUM_EXPORT_ITEMS) {
          message.error(
            `There is too much items to export (> ${MAXIMUM_EXPORT_ITEMS}). Try to change filters or export only current page.`,
          );
          return;
        }

        const flatData = flatDataItems<T>(items);
        for (const row of flatData) {
          const csvRow = columnsToExport.map((column): CsvValue => {
            const columnDataType = { ...UNKNOWN, ...column.type };
            const value = isSimpleColumn(column)
              ? applyFieldAccessor(row, column.key)
              : column.value(row);
            return csvValue(columnDataType.stringify?.(value as any, row) ?? '');
          });
          result.push(csvRow);
        }
        if (pagesMode === 'CURRENT') {
          break;
        }
        totalPages = Math.ceil(totalItemsCount / pageSize);
        page++;
      } while (page <= totalPages);
      const fileName = `table_data_${new Date().toISOString().replace(/[^\dA-Za-z]/g, '_')}.csv`;
      message.success(`Data export finished, downloading should start in a moment!`);
      download(fileName, serialize(result));
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
      const result: CsvRow[] = [];
      const columnsToExport = prepareColumns(columns);
      result.push(
        columnsToExport.map((adjustedColumn) =>
          csvValue(typeof adjustedColumn.title === 'string' ? adjustedColumn.title : '-'),
        ),
      );

      const { total, items } = await onPaginateData({ pageSize });
      const totalItemsCount = total ?? items.length;
      if (totalItemsCount > MAXIMUM_EXPORT_ITEMS) {
        message.error(
          `There is too much items to export (> ${MAXIMUM_EXPORT_ITEMS}). Try to change filters or export only current page.`,
        );
        return;
      }
      const flatData = flatDataItems<T>(items);
      for (const row of flatData) {
        const csvRow = columnsToExport.map((column): CsvValue => {
          const columnDataType = { ...UNKNOWN, ...column.type };
          const value = isSimpleColumn(column)
            ? applyFieldAccessor(row, column.key)
            : column.value(row);
          return csvValue(columnDataType.stringify?.(value as any, row) ?? '');
        });
        result.push(csvRow);
      }

      const fileName = `table_data_${new Date().toISOString().replace(/[^\dA-Za-z]/g, '_')}.csv`;
      message.success(`Data export finished, downloading should start in a moment!`);
      download(fileName, serialize(result));
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
      placement="bottom"
      content={
        <form onSubmit={handleDownload}>
          <div className={s.form}>
            <Form.Layout.Label title="Data set">
              <Radio.Group
                onChange={(e) => {
                  setPagesMode(e.target.value);
                }}
                value={pagesMode}
              >
                <Radio value="ALL" defaultChecked>
                  All pages
                </Radio>
                <Radio value="CURRENT">Current page</Radio>
              </Radio.Group>
            </Form.Layout.Label>
            <Form.Layout.Label title="Format">
              <Select
                defaultValue="csv"
                disabled
                options={[
                  {
                    value: 'csv',
                    label: 'CSV',
                  },
                ]}
              />
            </Form.Layout.Label>
            <Button isDisabled={progress != null} htmlType="submit" type="PRIMARY">
              {progress == null
                ? 'Download'
                : `Downloading (${progress.page}/${progress.totalPages})...`}
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
  const result = [];
  for (const column of columns) {
    const title = typeof column.title === 'string' ? column.title : '-';
    if (isGroupColumn(column)) {
      result.push(...prepareColumns(column.children, `${title} / `));
    } else if (
      (isSimpleColumn(column) || isDerivedColumn(column)) &&
      column.exporting !== false &&
      column.hideInTable !== true
    ) {
      result.push({
        ...column,
        title: prefix + title,
      });
    }
  }
  return result;
}
