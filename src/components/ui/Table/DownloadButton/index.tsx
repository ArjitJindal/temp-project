import React, { useState } from 'react';
import _ from 'lodash';
import { message, Popover, Radio, Select } from 'antd';
import s from './styles.module.less';
import DownloadFillIcon from '@/components/ui/icons/Remix/system/download-fill.react.svg';
import Button from '@/components/ui/Button';
import { flatItems } from '@/components/ui/Table/utils';
import { download } from '@/utils/browser';
import { isGroupColumn, TableColumn, TableData } from '@/components/ui/Table/types';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import * as Form from '@/components/ui/Form';
import { getErrorMessage } from '@/utils/lang';
import { CsvRow, CsvValue, csvValue, serialize } from '@/utils/csv';
import { PaginationParams } from '@/utils/queries/hooks';

const MAXIMUM_EXPORT_ITEMS = 10000;

type Props<T extends object> = {
  currentPage: number;
  rowKey: string;
  onExportData: (params: PaginationParams) => Promise<TableData<T>>;
  columns: TableColumn<T>[];
};

function prepareColumns<T extends object>(
  columns: TableColumn<T>[],
  prefix = '',
): TableColumn<T>[] {
  const result = [];
  for (const column of columns) {
    const title = typeof column.title === 'string' ? column.title : '-';
    if (isGroupColumn(column)) {
      result.push(...prepareColumns(column.children, `${title} / `));
    } else if (column.hideInTable !== true && 'exportData' in column) {
      result.push({
        ...column,
        title: prefix + title,
      });
    }
  }
  return result;
}

export default function DownloadButton<T extends object>(props: Props<T>) {
  const { currentPage, columns, onExportData, rowKey } = props;

  const [pagesMode, setPagesMode] = useState<'ALL' | 'CURRENT'>('ALL');
  const [progress, setProgress] = useState<null | { page: number; totalPages: number }>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
        const pageSize = DEFAULT_PAGE_SIZE;
        const { total, items } = await onExportData({ page, pageSize });
        const totalItemsCount = total ?? items.length;
        if (pagesMode === 'ALL' && totalItemsCount > MAXIMUM_EXPORT_ITEMS) {
          message.error(
            `There is too much items to export (> ${MAXIMUM_EXPORT_ITEMS}). Try to change filters or export only current page.`,
          );
          return;
        }

        const flatData = flatItems<T>(items, rowKey);
        for (const row of flatData) {
          const csvRow = columnsToExport.map((column): CsvValue => {
            let data: unknown;
            if ('exportData' in column) {
              const exportData = column.exportData;
              if (typeof exportData === 'function') {
                data = (exportData as (entity: T) => unknown)(row);
              } else if (typeof exportData === 'string') {
                data = _.get(row, exportData);
              }
            }
            return csvValue(data);
          });
          result.push(csvRow);
        }
        if (pagesMode === 'CURRENT') {
          break;
        }
        totalPages = Math.ceil(totalItemsCount / pageSize);
        page++;
      } while (page < totalPages);
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

  return (
    <Popover
      placement="bottom"
      content={
        <form onSubmit={handleSubmit}>
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
            <Button disabled={progress != null} htmlType="submit" type="primary">
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
        <DownloadFillIcon className={s.icon} />
      </div>
    </Popover>
  );
}
