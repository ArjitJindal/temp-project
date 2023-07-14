import { useRef, useState, useContext, useMemo } from 'react';
import { Typography } from 'antd';
import _ from 'lodash';
import AuditLogModal from '../AuditLogModal';
import ActionsFilterButton from '../ActionsFilterButton';
import { TableItem, TableSearchParams } from './types';
import { useTableData } from './helpers';
import SearchIcon from '@/components/ui/icons/Remix/system/search-2-line.react.svg';
import DatePicker from '@/components/ui/DatePicker';
import { useApi } from '@/api';
import { AllParams, TableColumn, TableRefType } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { AuditLog } from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import { useApiTime } from '@/utils/tracker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE } from '@/components/library/Table/standardDataTypes';
import EntityFilterButton from '@/pages/auditlog/components/EntityFilterButton';
import ActionTakenByFilterButton from '@/pages/auditlog/components/ActionTakeByFilterButton';
import { PageWrapperContentContainer, PageWrapperContext } from '@/components/PageWrapper';
import { Assignee } from '@/components/Assignee';

export default function AuditLogTable() {
  const api = useApi();
  const measure = useApiTime();
  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
  const context = useContext(PageWrapperContext);
  const finalParams = useMemo(
    () => ({ ...params, includeRootUserRecords: context?.superAdminMode }),
    [context?.superAdminMode, params],
  );
  const queryResults = usePaginatedQuery<AuditLog>(
    AUDIT_LOGS_LIST(finalParams),
    async (paginationParams) => {
      const {
        sort,
        page,
        filterTypes,
        createdTimestamp,
        filterActionTakenBy,
        filterActions,
        searchEntityId,
        includeRootUserRecords,
      } = finalParams;
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
            includeRootUserRecords,
            searchEntityId,
            filterActions,
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
    helper.derived({
      title: 'Entity',
      value: (item) => {
        return {
          entityType: item.type,
          entityId:
            item.type === 'RULE' ? `${item.logMetadata.ruleId} (${item.entityId})` : item.entityId,
        };
      },
      type: {
        render: (value) => {
          return (
            <>
              <Typography.Text>{value?.entityType}</Typography.Text>
              <Typography.Text type={'secondary'}>{value?.entityId}</Typography.Text>
            </>
          );
        },
      },
    }),
    helper.simple<'action'>({
      title: 'Event',
      key: 'action',
    }),
    helper.derived({
      title: 'Changes',
      value: (item) => item,
      type: {
        render: (item) => {
          if (!item || _.isEqual(item.oldImage, item.newImage)) {
            return <Typography.Text type={'secondary'}>-</Typography.Text>;
          }
          return <AuditLogModal data={item} />;
        },
      },
    }),
    helper.simple<'user.id'>({
      key: 'user.id',
      title: 'Action Taken By',
      type: {
        render: (userId) => {
          return (
            <div style={{ overflowWrap: 'anywhere' }}>
              <Assignee accountId={userId} />
            </div>
          );
        },
      },
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
        pagination={true}
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
          {
            key: 'filterActions',
            title: 'Actions',
            renderer: ({ params, setParams }) => (
              <ActionsFilterButton
                initialState={params.filterActions ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterActions: value,
                  }));
                }}
              />
            ),
          },
          {
            title: 'Entity ID',
            key: 'searchEntityId',
            renderer: { kind: 'string' },
            showFilterByDefault: true,
            icon: <SearchIcon />,
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
