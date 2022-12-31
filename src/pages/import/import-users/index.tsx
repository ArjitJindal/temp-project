import React, { useState } from 'react';
import { Tag } from 'antd';
import { files } from './service';
import type { TableListItem } from './data';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { TableColumn } from '@/components/ui/Table/types';
import { CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { USER_FILES } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { usePageViewTracker } from '@/utils/tracker';

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
  usePageViewTracker('Import Users Page');
  const columns: TableColumn<TableListItem>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      tip: 'File identifier',
      render: (dom) => {
        return <a>{dom}</a>;
      },
    },
    {
      title: 'Filename',
      dataIndex: 'filename',
      valueType: 'text',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: 'Total Users',
      dataIndex: 'totalUsers',
      valueType: 'digit',
    },
    {
      title: 'Imported Users',
      dataIndex: 'importedUsers',
      valueType: 'digit',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      valueType: 'text',
      render: (status: any) => {
        return (
          <span>
            <Tag color={getStatusColor(status)}>{status}</Tag>
          </span>
        );
      },
    },
  ];

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
      <QueryResultsTable<TableListItem, CommonParams>
        form={{
          labelWrap: true,
        }}
        headerTitle="Files"
        rowKey="id"
        search={false}
        columns={columns}
        params={params}
        onChangeParams={setParams}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-files-list',
        }}
        queryResults={filesResult}
        toolBarRender={() => [
          <FileImportButton type={'USER'} buttonText="Import (Consumer User)" />,
          <FileImportButton type={'BUSINESS'} buttonText="Import (Business User)" />,
        ]}
        autoAdjustHeight
      />
    </PageWrapper>
  );
};

export default TableList;
