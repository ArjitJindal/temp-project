import React, { useState } from 'react';
import { Tag } from 'antd';
import { files } from './service';
import type { TableListItem } from './data';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { USER_FILES } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
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
  const helper = new ColumnHelper<TableListItem>();
  const columns: TableColumn<TableListItem>[] = helper.list([
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
      title: 'Created at',
      type: {
        render: (date) => <TimestampDisplay timestamp={date?.getTime()} />,
        stringify: (date) => dayjs(date?.getDate()).format(DEFAULT_DATE_TIME_FORMAT),
        autoFilterDataType: { kind: 'dateTimeRange' },
      },
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
  ]);

  const i18n = useI18n();

  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  const filesResult = useQuery(USER_FILES(params), async () => {
    const result = await files({
      page: params.page,
      pageSize: params.pageSize,
    });
    return result;
  });

  return (
    <PageWrapper title={i18n('menu.import.import-users')}>
      <PageWrapperContentContainer>
        <QueryResultsTable<TableListItem, CommonParams>
          // headerTitle="Files"
          rowKey="id"
          tableId="users-files-list"
          columns={columns}
          params={params}
          onChangeParams={setParams}
          queryResults={filesResult}
          extraTools={[
            () => (
              <FileImportButton
                type={'USER'}
                buttonText="Import (Consumer user)"
                requiredPermissions={['users:import:write']}
              />
            ),
            () => (
              <FileImportButton
                type={'BUSINESS'}
                buttonText="Import (Business user)"
                requiredPermissions={['users:import:write']}
              />
            ),
          ]}
          fitHeight
        />
      </PageWrapperContentContainer>
    </PageWrapper>
  );
};

export default TableList;
