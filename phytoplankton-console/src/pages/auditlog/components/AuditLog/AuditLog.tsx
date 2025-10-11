import { useRef, useState, useContext, useMemo, useCallback } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { isEqual } from 'lodash';
import { HighlightOutlined } from '@ant-design/icons';
import RuleAuditLogModal from '../RuleAuditLogModal';
import ActionsFilterButton from '../ActionsFilterButton';
import AuditLogModal from '../AuditLogModal';
import RiskFactorAuditLogModal from '../RiskFactorAuditLogModal';
import { TableItem, TableSearchParams } from './types';
import { auditLogQueryAdapter, useTableData } from './helpers';
import s from './index.module.less';
import SearchIcon from '@/components/ui/icons/Remix/system/search-2-line.react.svg';
import DatePicker from '@/components/ui/DatePicker';
import { AllParams, TableColumn, TableRefType } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { useAuditLogsList } from '@/hooks/api/audit-logs';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import EntityFilterButton from '@/pages/auditlog/components/EntityFilterButton';
import { AccountsFilter } from '@/components/library/AccountsFilter';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import AccountTag from '@/components/AccountTag';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { SuperAdminModeContext } from '@/components/AppWrapper/Providers/SuperAdminModeProvider';
import { makeUrl, useNavigationParams } from '@/utils/routing';
import TagList from '@/components/library/Tag/TagList';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { P } from '@/components/ui/Typography';

export default function AuditLogTable() {
  const [params, setParams] = useNavigationParams<AllParams<TableSearchParams>>({
    queryAdapter: {
      serializer: auditLogQueryAdapter.serializer,
      deserializer: (raw) => ({
        ...DEFAULT_PARAMS_STATE,
        ...auditLogQueryAdapter.deserializer(raw),
      }),
    },
    makeUrl: (rawQueryParams) => makeUrl('/auditlog', {}, rawQueryParams),
    persist: {
      id: 'auditlog-navigation-params',
    },
  });

  const handleChangeParams = useCallback(
    (newParams: AllParams<TableSearchParams>) => {
      setParams(newParams);
    },
    [setParams],
  );

  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const context = useContext(SuperAdminModeContext);
  const finalParams = useMemo(
    () => ({ ...params, includeRootUserRecords: context?.isSuperAdminMode }),
    [context?.isSuperAdminMode, params],
  );

  const startTime = dayjs().subtract(1, 'day').startOf('day');
  const endTime = dayjs().endOf('day');

  const defaultDateRange: RangeValue<Dayjs> = [startTime, endTime];
  const queryResults = useAuditLogsList(finalParams);

  const getDateRangeToShow = (createdTimeStamp: RangeValue<Dayjs> | undefined) => {
    return isDatePickerOpen ? createdTimeStamp ?? defaultDateRange : createdTimeStamp;
  };

  const tableQueryResult = useTableData(queryResults);

  const actionRef = useRef<TableRefType>(null);
  const helper = new ColumnHelper<TableItem>();

  const columns: TableColumn<TableItem>[] = helper.list([
    helper.simple<'auditlogId'>({
      title: 'Audit log ID',
      key: 'auditlogId',
    }),
    helper.derived({
      title: 'Entity',
      value: (item) => {
        return {
          entityType: item.type,
          entityId:
            item.type === 'RULE' && item.action !== 'DOWNLOAD'
              ? `${item.logMetadata.ruleId} (${item.entityId})`
              : item.entityId,
        };
      },
      type: {
        render: (value) => {
          return (
            <TagList>
              <span data-cy="auditlog-primary">{value?.entityType}</span>
              <P variant="m" grey data-cy="auditlog-secondary">
                {value?.entityId}
              </P>
            </TagList>
          );
        },
        stringify: (item) => {
          return `${item?.entityType},${item?.entityId}`;
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
      exporting: false,
      type: {
        render: (item) => {
          if (!item || isEqual(item.oldImage, item.newImage)) {
            return (
              <P variant="m" grey>
                -
              </P>
            );
          }
          if (item.type === 'RULE') {
            if (item.action === 'DOWNLOAD') {
              return (
                <P variant="m" grey>
                  -
                </P>
              );
            }
            return <RuleAuditLogModal data={item} />;
          }
          if (item.type === 'RISK_FACTOR') {
            return <RiskFactorAuditLogModal data={item} />;
          }
          return (
            <AuditLogModal
              data={{
                type: item.type,
                oldImage: item.oldImage,
                newImage: item.newImage,
                showNotChanged: true,
                showOldImage: true,
              }}
            />
          );
        },
      },
    }),
    helper.derived({
      title: 'Changes',
      hideInTable: true,
      exporting: true,
      value: (item) => item,
      type: {
        render: (item) =>
          !item || isEqual(item.oldImage, item.newImage) ? <div>No</div> : <div>Yes</div>,
        stringify: (item) => (!item || isEqual(item.oldImage, item.newImage) ? 'No' : 'Yes'),
      },
    }),
    helper.derived({
      title: 'Parameter',
      hideInTable: true,
      exporting: true,
      value: (item) => {
        if (item.newImage) {
          return Object.entries(item.newImage)
            .map(([key]) => `${key}`)
            .join(', ');
        }
        return '';
      },
    }),
    helper.derived({
      title: 'Old value',
      hideInTable: true,
      exporting: true,
      value: (item) => {
        if (item.newImage) {
          return Object.entries(item.newImage)
            .map(([key]) => `${key}: N/A`)
            .join(', ');
        }
        return '';
      },
    }),
    helper.derived({
      title: 'New value',
      hideInTable: true,
      exporting: true,
      value: (item) => {
        if (item.newImage) {
          return Object.entries(item.newImage)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        }
        return '';
      },
    }),
    helper.simple<'user.id'>({
      key: 'user.id',
      title: 'Action taken by',
      type: {
        render: (userId) => {
          return (
            <div className={s.overflowWrapAnywhere}>
              <AccountTag accountId={userId} />
            </div>
          );
        },
      },
    }),
    helper.simple<'timestamp'>({
      title: 'Time of action',
      key: 'timestamp',
      type: DATE_TIME,
    }),
  ]);

  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<TableItem, TableSearchParams>
        tableId="audit-log"
        rowKey="auditlogId"
        queryResults={tableQueryResult}
        params={params}
        onChangeParams={handleChangeParams}
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
            title: 'Action taken by',
            renderer: ({ params, setParams }) => (
              <AccountsFilter
                title="Action taken by"
                Icon={<HighlightOutlined />}
                users={params.filterActionTakenBy ?? []}
                includeUnassigned={false}
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
              value={getDateRangeToShow(params.createdTimestamp)}
              onChange={(createdTimestamp) =>
                setParams((prevState) => ({ ...prevState, createdTimestamp }))
              }
              onOpenChange={(state) => {
                setIsDatePickerOpen(state);
              }}
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
