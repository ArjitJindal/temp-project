import React, { useState } from 'react';
import { Radio } from 'antd';
import {
  DerivedColumn,
  FieldAccessor,
  isDerivedColumn,
  isGroupColumn,
  isSimpleColumn,
  PaginatedParams,
  SimpleColumn,
  TableColumn,
  TableData,
} from '../../../types';
import {
  DEFAULT_DOWNLOAD_VIEW,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGINATION_ENABLED,
} from '../../../consts';
import s from './styles.module.less';
import { iterateItems } from './helpers';
import Popover from '@/components/ui/Popover';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import Button from '@/components/library/Button';
import { flatDataItems } from '@/components/library/Table/internal/helpers';
import * as Form from '@/components/ui/Form';
import { getErrorMessage } from '@/utils/lang';
import { downloadAsCSV } from '@/utils/csv';
import { PaginationParams } from '@/utils/queries/hooks';
import { downloadAsXLSX } from '@/utils/xlsx';
import Alert from '@/components/library/Alert';
import { message } from '@/components/library/Message';
import { generateTableExportData } from '@/components/library/Table/Header/Tools/DownloadButton/helpers';
import { ExportData, MAXIMUM_EXPORT_ITEMS } from '@/utils/data-export';

type Props<Item extends object, Params extends object> = {
  onPaginateData: (params: PaginationParams) => Promise<TableData<Item>>;
  columns: TableColumn<Item>[];
  params: PaginatedParams<Params>;
  cursorPagination?: boolean;
  totalPages?: number;
};

export default function DownloadButton<T extends object, Params extends object>(
  props: Props<T, Params>,
) {
  const {
    columns,
    onPaginateData,
    params: {
      pageSize = DEFAULT_PAGE_SIZE,
      pagination = DEFAULT_PAGINATION_ENABLED,
      view = DEFAULT_DOWNLOAD_VIEW,
    },
    totalPages = 1,
  } = props;

  const [pagesMode, setPagesMode] = useState<'ALL' | 'CURRENT'>('CURRENT');
  const [progress, setProgress] = useState<null | { page: number; totalPages?: number }>(null);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [isDownloadError, setIsDownloadError] = useState<boolean>(false);
  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDownloadError(false);
    const columnsToExport = prepareColumns(columns);
    const allFlatData: T[] = [];
    for await (const item of iterateItems({
      pagesMode,
      onPaginateData,
      params: props.params,
      setProgress,
    })) {
      allFlatData.push(item);
      if (allFlatData.length >= MAXIMUM_EXPORT_ITEMS) {
        setIsDownloadError(true);
        break;
      }
    }
    const exportData: ExportData = generateTableExportData(
      allFlatData,
      columnsToExport,
      props.params,
    );
    if (format === 'csv') {
      await downloadAsCSV(exportData);
    } else {
      await downloadAsXLSX(exportData);
    }
  };

  const handleNonPaginatedDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDownloadError(false);
    try {
      const columnsToExport = prepareColumns(columns);
      const { total, items } = await onPaginateData({ pageSize, view });
      const totalItemsCount = total ?? items.length;
      if (totalItemsCount > MAXIMUM_EXPORT_ITEMS) {
        setIsDownloadError(true);
      }
      const flatData = flatDataItems<T>(items);
      const exportData: ExportData = generateTableExportData(
        flatData,
        columnsToExport,
        props.params,
      );

      if (format === 'csv') {
        await downloadAsCSV(exportData);
      } else {
        await downloadAsXLSX(exportData);
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
                </Radio.Group>
              </Form.Layout.Label>
            )}
            {pagesMode === 'ALL' && (
              <Alert type="INFO">
                This option downloads up to {new Intl.NumberFormat().format(MAXIMUM_EXPORT_ITEMS)}{' '}
                rows. Browser capacity may also impact the download.
              </Alert>
            )}
            {isDownloadError && (
              <Alert type="ERROR">
                Download failed for several pages due to a browser capacity. Please try downloading
                for up to {new Intl.NumberFormat().format(MAXIMUM_EXPORT_ITEMS)} rows.
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
