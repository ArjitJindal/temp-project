import React, { useRef, useState } from 'react';
import { Typography } from 'antd';
import AuditLogModal from '../AuditLogModal';
import { TableItem, TableSearchParams } from './types';
import { useTableData } from './helpers';
import DatePicker from '@/components/ui/DatePicker';
import { useApi } from '@/api';
import { AllParams, TableColumn, TableRefType } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { AuditLog } from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import { useApiTime } from '@/utils/tracker';
import { dayjs } from '@/utils/dayjs';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE } from '@/components/library/Table/standardDataTypes';
import EntityFilterButton from '@/pages/auditlog/components/EntityFilterButton';
import ActionTakenByFilterButton from '@/pages/auditlog/components/ActionTakeByFilterButton';
import { PageWrapperContentContainer } from '@/components/PageWrapper';

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

  const actionRef = useRef<TableRefType>(null);

  const helper = new ColumnHelper<TableItem>();

  const columns: TableColumn<TableItem>[] = helper.list([
    helper.simple<'auditlogId'>({
      title: 'Audit Log ID',
      key: 'auditlogId',
    }),
    helper.simple<'type'>({
      title: 'Entity',
      key: 'type',
      type: {
        render: (type, { item: entity }) => {
          return (
            <>
              <Typography.Text>{type}</Typography.Text>
              <br />
              <Typography.Text type={'secondary'}>{entity.entityId}</Typography.Text>
            </>
          );
        },
      },
    }),
    helper.simple<'action'>({
      title: 'Event',
      key: 'action',
    }),
    helper.simple<'oldImage'>({
      key: 'oldImage',
      title: 'Before',
      type: {
        render: (oldImage, { item: entity }) => {
          if (!oldImage || !Object.keys(oldImage).length) {
            return <Typography.Text type={'secondary'}>-</Typography.Text>;
          }
          return <AuditLogModal data={entity} />;
        },
      },
    }),
    helper.simple<'newImage'>({
      key: 'newImage',
      title: 'After',
      type: {
        render: (newImage, { item: entity }) => {
          if (!newImage || !Object.keys(newImage).length) {
            return <Typography.Text type={'secondary'}>-</Typography.Text>;
          }
          return <AuditLogModal data={entity} />;
        },
      },
    }),
    helper.simple<'user.email'>({
      key: 'user.email',
      title: 'Action Taken By',
    }),
    helper.simple<'timestamp'>({
      title: 'Time of Action',
      key: 'timestamp',
      type: DATE,
    }),
  ]);

  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<TableItem, TableSearchParams>
        tableId="audit-log"
        rowKey="auditlogId"
        queryResults={tableQueryResult}
        params={params}
        onChangeParams={setParams}
        extraFilters={[
          {
            key: 'filterTypes',
            title: 'Entity',
            renderer: ({ params, setParams }) => (
              <EntityFilterButton
                initialState={params.filterTypes ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterTypes: value,
                  }));
                }}
              />
            ),
          },
          {
            key: 'filterActionTakenBy',
            title: 'Action Taken By',
            renderer: ({ params, setParams }) => (
              <ActionTakenByFilterButton
                initialState={params.filterActionTakenBy ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterActionTakenBy: value,
                  }));
                }}
              />
            ),
          },
        ]}
        extraTools={[
          () => (
            <DatePicker.RangePicker
              value={params.createdTimestamp}
              onChange={(createdTimestamp) =>
                setParams((prevState) => ({ ...prevState, createdTimestamp }))
              }
            />
          ),
        ]}
        innerRef={actionRef}
        columns={columns}
        fitHeight
      />
    </PageWrapperContentContainer>
  );
}
