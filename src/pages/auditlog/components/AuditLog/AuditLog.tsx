import { useRef, useState } from 'react';
import { Typography } from 'antd';
import EntityFilterButton from '../EntityFilterButton';
import AuditLogModal from '../AuditLogModal';
import ActionTakenByFilterButton from '../ActionTakeByFilterButton';
import { TableSearchParams } from './types';
import { useTableData } from './helpers';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { AllParams, DEFAULT_PARAMS_STATE, TableActionType } from '@/components/ui/Table';
import { TableColumn } from '@/components/ui/Table/types';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { AuditLog } from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import { useApiTime } from '@/utils/tracker';

export default function AuditLogTable() {
  const api = useApi();
  const measure = useApiTime();

  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    createdTimestamp: [dayjs().subtract(1, 'day'), dayjs()],
  });

  const queryResults = usePaginatedQuery<AuditLog>(
    AUDIT_LOGS_LIST(params),
    async (paginationParams) => {
      const { sort, page, filterTypes, createdTimestamp, filterActionTakenBy } = params;
      const [sortField, sortOrder] = sort[0] ?? [];
      const [start, end] = createdTimestamp ?? [];

      const response = await measure(
        () =>
          api.getAuditlog({
            page,
            ...paginationParams,
            afterTimestamp: start ? start.startOf('day').valueOf() : 0,
            beforeTimestamp: end ? end.endOf('day').valueOf() : Number.MAX_SAFE_INTEGER,
            sortField: sortField ?? undefined,
            sortOrder: sortOrder ?? undefined,
            filterTypes,
            filterActionTakenBy,
          }),
        'Get Audit Logs',
      );

      return {
        total: response.total,
        items: response.data,
      };
    },
  );

  const tableQueryResult = useTableData(queryResults);

  const actionRef = useRef<TableActionType>(null);

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  // todo: i18n
  const columns: TableColumn<AuditLog>[] = [
    {
      title: 'Audit Log ID',
      dataIndex: 'auditlogId',
      width: 130,
      copyable: true,
      ellipsis: true,
      hideInSearch: true,
      exportData: 'auditlogId',
    },
    {
      title: 'Entity',
      dataIndex: 'type',
      valueType: 'text',
      width: 130,
      render: (_, entity) => {
        return (
          <>
            <Typography.Text>{entity.type}</Typography.Text>
            <br />
            <Typography.Text type={'secondary'}>{entity.entityId}</Typography.Text>
          </>
        );
      },
      hideInSearch: true,
      exportData: 'type',
    },
    {
      title: 'Event',
      dataIndex: 'action',
      width: 150,
      hideInSearch: true,
      exportData: 'action',
    },
    {
      title: 'Before',
      width: 150,
      dataIndex: 'oldImage',
      hideInSearch: true,
      render: (_, entity) => {
        if (!entity?.oldImage || !Object.keys(entity?.oldImage).length) {
          return <Typography.Text type={'secondary'}>-</Typography.Text>;
        }
        return <AuditLogModal data={entity} />;
      },
      exportData: 'oldImage',
    },
    {
      title: 'After',
      width: 150,
      dataIndex: 'newImage',
      hideInSearch: true,
      render: (_, entity) => {
        if (!entity?.newImage || !Object.keys(entity?.newImage).length) {
          return <Typography.Text type={'secondary'}>-</Typography.Text>;
        }
        return <AuditLogModal data={entity} />;
      },
      exportData: 'newImage',
    },
    {
      title: 'Action Taken By',
      width: 150,
      dataIndex: 'user.email',
      render: (_, entity) => {
        return entity.user?.email;
      },
      hideInSearch: true,
      exportData: 'user.email',
    },
    {
      title: 'Time of Action',
      dataIndex: 'timestamp',
      width: 150,
      render: (_, entity) => {
        return <TimestampDisplay timestamp={entity.timestamp} />;
      },
      hideInSearch: true,
      exportData: 'timestamp',
    },
  ];

  return (
    <QueryResultsTable<AuditLog, TableSearchParams>
      queryResults={tableQueryResult}
      params={params}
      showResultsInfo
      onChangeParams={setParams}
      actionsHeader={[
        ({ params, setParams }) => {
          return (
            <>
              <EntityFilterButton
                initialState={params.filterTypes ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterTypes: value,
                  }));
                }}
              />
            </>
          );
        },
        ({ params, setParams }) => {
          return (
            <>
              <ActionTakenByFilterButton
                initialState={params.filterActionTakenBy ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterActionTakenBy: value,
                  }));
                }}
              />
            </>
          );
        },
      ]}
      form={{
        labelWrap: true,
      }}
      toolBarRender={() => [
        <DatePicker.RangePicker
          value={params.createdTimestamp}
          onChange={(createdTimestamp) =>
            setParams((prevState) => ({ ...prevState, createdTimestamp }))
          }
        />,
      ]}
      search={false}
      bordered
      actionRef={actionRef}
      rowKey="caseId"
      scroll={{ x: 1300 }}
      columns={columns}
      rowSelection={{
        selectedKeys: selectedEntities,
        onChange: setSelectedEntities,
      }}
      autoAdjustHeight
    />
  );
}
