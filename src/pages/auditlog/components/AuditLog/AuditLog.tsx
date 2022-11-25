import { useCallback, useRef, useState } from 'react';
import moment from 'moment';
import { Typography, DatePicker } from 'antd';
import _ from 'lodash';
import { useNavigate } from 'react-router';
import EntityFilterButton from '../EntityFilterButton';
import { TableSearchParams } from './types';
import { useTableData } from './helpers';
import { useApi } from '@/api';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { AllParams, DEFAULT_PARAMS_STATE, TableActionType } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { TableColumn } from '@/components/ui/Table/types';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { AuditLog, AuditLogListResponse } from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import { queryAdapter } from '@/pages/case-management/helpers';
import { useDeepEqualEffect } from '@/utils/hooks';
import { makeUrl, parseQueryString } from '@/utils/routing';

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

  const queryResults = useQuery<AuditLogListResponse>(AUDIT_LOGS_LIST({ ...params }), async () => {
    const { sort, page, timestamp, filterTypes } = params;
    const [sortField, sortOrder] = sort[0] ?? [];
    const [response, time] = await measure(() =>
      api.getAuditlog({
        limit: DEFAULT_PAGE_SIZE!,
        skip: (page! - 1) * DEFAULT_PAGE_SIZE!,
        afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
        beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Number.MAX_SAFE_INTEGER,
        filterTypes: filterTypes,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
      }),
    );
    analytics.event({
      title: 'Table Loaded',
      time,
    });
    return response;
  });

  const tableQueryResult = useTableData(queryResults);
  const navigate = useNavigate();

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
    },
    {
      title: 'After',
      width: 150,
      dataIndex: 'newImage',
      hideInSearch: true,
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
      dataIndex: 'timestamp',
      width: 150,
      valueType: 'dateRange',
      hideInTable: true,
    },
  ];

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      navigate(makeUrl('/auditlog', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  const handleChangeParams = (params: AllParams<TableSearchParams>) => {
    pushParamsToNavigation({
      ...params,
      page: params.page,
      sort: params.sort,
      filterTypes: params.filterTypes,
      timestamp: params.timestamp,
    });
  };

  return (
    <QueryResultsTable<AuditLog, TableSearchParams>
      queryResults={tableQueryResult}
      params={params}
      showResultsInfo
      onChangeParams={handleChangeParams}
      actionsHeader={[
        ({ params, setParams }) => {
          console.log('params', params);
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
              <DatePicker.RangePicker
                value={[
                  params.timestamp ? moment(params.timestamp[0]) : moment().subtract(1, 'days'),
                  params.timestamp ? moment(params.timestamp[1]) : moment(),
                ]}
                onChange={(value) => {
                  _.debounce(() => {
                    setParams((prevState) => ({
                      ...prevState,
                      timestamp:
                        value && value[0] && value[1]
                          ? [`${value[0].valueOf()}`, `${value[1].valueOf()}`]
                          : [`${moment().subtract(1, 'days').valueOf()}`, `${moment().valueOf()}`],
                    }));
                  }, 200)();
                }}
              />
            </>
          );
        },
      ]}
      form={{
        labelWrap: true,
      }}
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
