import { useCallback, useRef, useState } from 'react';
import moment, { Moment } from 'moment';
import { Typography, DatePicker } from 'antd';
import { RangeValue } from 'rc-picker/lib/interface';
import { TableSearchParams } from './types';
import { useApi } from '@/api';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { queryAdapter } from '@/pages/case-management/helpers';
import { AllParams, DEFAULT_PARAMS_STATE, TableActionType } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';

import { TableColumn, TableData } from '@/components/ui/Table/types';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { RequestTable } from '@/components/RequestTable';
import { AuditLog } from '@/apis';

export type AuditLogItem = AuditLog & {
  index: number;
  rowKey: string;
};

export default function AuditLogTable() {
  const api = useApi();
  const analytics = useAnalytics();

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));

  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });

  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableSearchParams>) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
    }));
  }, [parsedParams]);

  const [dateRange, setDateRange] = useState<RangeValue<Moment>>([
    moment().subtract(1, 'day'),
    moment(),
  ]);

  const results = useCallback(async (): Promise<TableData<AuditLog>> => {
    const { sort, page, filterTypes } = params;
    let startTimestamp = moment().subtract(1, 'day').valueOf();
    let endTimestamp = Date.now();
    const [sortField, sortOrder] = sort[0] ?? [];
    const [start, end] = dateRange ?? [];
    if (start != null && end != null) {
      startTimestamp = start.startOf('day').valueOf();
      endTimestamp = end.endOf('day').valueOf();
    }
    const [response, time] = await measure(() =>
      api.getAuditlog({
        limit: DEFAULT_PAGE_SIZE!,
        skip: (page! - 1) * DEFAULT_PAGE_SIZE!,
        afterTimestamp: startTimestamp,
        beforeTimestamp: endTimestamp,
        filterTypes: filterTypes,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
      }),
    );
    analytics.event({
      title: 'Table Loaded',
      time,
    });
    return {
      success: true,
      total: response.data.length,
      items: response.data,
    };
  }, [analytics, api, dateRange, params]);

  // const tableQueryResult = useTableData(results);

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
    <RequestTable<AuditLog>
      request={results}
      form={{
        labelWrap: true,
      }}
      toolBarRender={() => [<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
      bordered
      search={false}
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
