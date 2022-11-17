import React, { useRef, useState } from 'react';
import { TableItem, TableSearchParams } from './types';
import { useTableData } from './helpers';
import { QueryResult } from '@/utils/queries/types';
import { AuditLogListResponse } from '@/apis';
import { TableColumn } from '@/components/ui/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableActionType } from '@/components/ui/Table';
import TimestampDisplay from '@/components/ui/TimestampDisplay';

interface Props {
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<AuditLogListResponse>;
}

export default function AuditLogs(props: Props) {
  const { queryResult, params } = props;

  const tableQueryResult = useTableData(queryResult);

  const actionRef = useRef<TableActionType>(null);

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  // todo: i18n
  const columns: TableColumn<TableItem>[] = [
    {
      title: 'Audit Log ID',
      dataIndex: 'auditlogId',
      width: 130,
      copyable: true,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: 'Entity',
      dataIndex: 'type',
      hideInTable: true,
      valueType: 'text',
      width: 130,
    },
    {
      title: 'Event',
      dataIndex: 'action',
      width: 150,
    },
    {
      title: 'Before',
      width: 150,
      dataIndex: 'oldImage',
    },
    {
      title: 'After',
      width: 150,
      dataIndex: 'newImage',
    },
    {
      title: 'Action Taken By',
      width: 150,
      dataIndex: 'user.email',
      render: (_, entity) => {
        return entity.user?.email;
      },
    },
    {
      title: 'Time of Action',
      dataIndex: 'timestamp',
      width: 150,
      render: (_, entity) => {
        return <TimestampDisplay timestamp={entity.timestamp} />;
      },
    },
  ];
  return (
    <QueryResultsTable<TableItem>
      showResultsInfo
      queryResults={tableQueryResult}
      params={params}
      form={{
        labelWrap: true,
      }}
      bordered
      search={false}
      isEvenRow={(item) => item.index % 2 === 0}
      actionRef={actionRef}
      rowKey="caseId"
      scroll={{ x: 1300 }}
      columns={columns}
      rowSelection={{
        selectedKeys: selectedEntities,
        onChange: setSelectedEntities,
      }}
    />
  );
}
