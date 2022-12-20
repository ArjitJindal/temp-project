import { useRef, useState } from 'react';
import { Typography } from 'antd';
import { RangeValue } from 'rc-picker/es/interface';
import EntityFilterButton from '../EntityFilterButton';
import AuditLogModal from '../AuditLogModal';
import { TableSearchParams } from './types';
import { useTableData } from './helpers';
import DatePicker from '@/components/ui/DatePicker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { AllParams, DEFAULT_PARAMS_STATE, TableActionType } from '@/components/ui/Table';
import { TableColumn } from '@/components/ui/Table/types';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { AuditLog, AuditLogListResponse } from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';

export type AuditLogItem = AuditLog & {
  index: number;
  rowKey: string;
};

export default function AuditLogTable() {
  const api = useApi();
  const analytics = useAnalytics();

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);

  const queryResults = useQuery<AuditLogListResponse>(AUDIT_LOGS_LIST({ ...params }), async () => {
    const { sort, page, filterTypes } = params;
    const [sortField, sortOrder] = sort[0] ?? [];
    const [start, end] = dateRange ?? [];

    const [response, time] = await measure(() =>
      api.getAuditlog({
        page,
        afterTimestamp: start ? start.startOf('day').valueOf() : 0,
        beforeTimestamp: end ? end.endOf('day').valueOf() : Number.MAX_SAFE_INTEGER,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
        filterTypes,
      }),
    );
    analytics.event({
      title: 'Table Loaded',
      time,
    });
    return response;
  });

  const tableQueryResult = useTableData(queryResults);

  const actionRef = useRef<TableActionType>(null);

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'day'),
    dayjs(),
  ]);

  // todo: i18n
  const columns: TableColumn<AuditLog>[] = [
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
    },
    {
      title: 'Event',
      dataIndex: 'action',
      width: 150,
      hideInSearch: true,
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
    },
    {
      title: 'Action Taken By',
      width: 150,
      dataIndex: 'user.email',
      render: (_, entity) => {
        return entity.user?.email;
      },
      hideInSearch: true,
    },
    {
      title: 'Time of Action',
      dataIndex: 'timestamp',
      width: 150,
      render: (_, entity) => {
        return <TimestampDisplay timestamp={entity.timestamp} />;
      },
      hideInSearch: true,
    },
    {
      title: 'Created At',
      dataIndex: 'createdTimestamp',
      width: 150,
      valueType: 'dateRange',
      hideInTable: true,
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
      ]}
      form={{
        labelWrap: true,
      }}
      toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
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
    />
  );
}
