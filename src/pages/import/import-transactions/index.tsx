import React, { useState } from 'react';
import { Tag } from 'antd';
import { files } from './service';
import { TableListItem } from './data';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTION_FILES } from '@/utils/queries/keys';
import { usePageViewTracker } from '@/utils/tracker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';

function getStatusColor(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'processing';
    case 'IMPORTED':
      return 'success';
    case 'FAILED':
      return 'error';
  }
  return 'warning';
}

const TableList: React.FC = () => {
  usePageViewTracker('Import Transactions Page');
  const helper = new ColumnHelper<TableListItem>();
  const columns: TableColumn<TableListItem>[] = [
    helper.simple<'id'>({
      key: 'id',
      title: 'ID',
      tooltip: 'File identifier',
    }),
    helper.simple<'filename'>({
      key: 'filename',
      title: 'Filename',
    }),
    helper.simple<'createdAt'>({
      key: 'createdAt',
      title: 'Created At',
      type: {
        render: (date) => <TimestampDisplay timestamp={date?.getTime()} />,
        stringify: (date) => dayjs(date?.getTime()).format(DEFAULT_DATE_TIME_FORMAT),
        autoFilterDataType: { kind: 'dateTimeRange' },
      },
    }),
    helper.simple<'totalTransactions'>({
      key: 'totalTransactions',
      title: 'Total Transactions',
    }),
    helper.simple<'importedTransactions'>({
      key: 'importedTransactions',
      title: 'Imported Transactions',
    }),
    helper.simple<'status'>({
      key: 'status',
      title: 'Status',
      type: {
        render: (status: string | undefined) => {
          return status ? (
            <span>
              <Tag color={getStatusColor(status)}>{status}</Tag>
            </span>
          ) : (
            <></>
          );
        },
      },
    }),
  ];

  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  const filesResult = useQuery(TRANSACTION_FILES(params), async () => {
    const result = await files({
      page: params.page,
      pageSize: params.pageSize,
    });
    return result;
  });

  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.import.import-transactions')}>
      <QueryResultsTable<TableListItem, CommonParams>
        tableId={'transactions-files-list'}
        rowKey="id"
        queryResults={filesResult}
        columns={columns}
        params={params}
        onChangeParams={setParams}
        extraTools={[() => <FileImportButton type={'TRANSACTION'} />]}
        fitHeight
      />
    </PageWrapper>
  );
};

export default TableList;
