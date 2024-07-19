import { useMemo, useState } from 'react';
import { Row, Space } from 'antd';
import s from './index.module.less';
import { KpiCard } from './KpiCard';
import { useApi } from '@/api';
import { SANCTIONS_SCREENING_DETAILS, SANCTIONS_SCREENING_STATS } from '@/utils/queries/keys';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  BooleanString,
  SanctionsScreeningDetails,
  SanctionsScreeningEntity,
  SanctionsScreeningEntityStats,
} from '@/apis';
import { AllParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Tag from '@/components/library/Tag';
import Id from '@/components/ui/Id';
import { useRules } from '@/utils/rules';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { SANCTIONS_SCREENING_ENTITYS } from '@/apis/models-custom/SanctionsScreeningEntity';
import { BOOLEAN } from '@/components/library/Table/standardDataTypes';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

type TableSearchParams = AllParams<{
  entity?: SanctionsScreeningEntity[];
  isHit?: BooleanString;
  isOngoingScreening?: BooleanString;
  isNew?: BooleanString;
  name?: string;
  afterTimestamp?: number;
  beforeTimestamp?: number;
}>;

const DEFAULT_DATE_RANGE_PARAMS = {
  afterTimestamp: dayjs().subtract(1, 'month').valueOf(),
  beforeTimestamp: dayjs().add(1, 'hour').valueOf(),
};

function getEntityName(entity: SanctionsScreeningEntity) {
  switch (entity) {
    case 'USER':
      return 'User';
    case 'BANK':
      return 'Bank name';
    case 'IBAN':
      return 'IBAN';
    case 'EXTERNAL_USER':
      return 'Transaction counterparty';
  }
}

export const SanctionsScreeningActivity = () => {
  const api = useApi();
  const [params, setParams] = useState<TableSearchParams>({
    ...DEFAULT_PARAMS_STATE,
    ...DEFAULT_DATE_RANGE_PARAMS,
  });
  const statsResult = useQuery(
    SANCTIONS_SCREENING_STATS({
      afterTimestamp: params.afterTimestamp,
      beforeTimestamp: params.beforeTimestamp,
    }),
    () => {
      return api.getSanctionsScreeningActivityStats({
        afterTimestamp: params.afterTimestamp,
        beforeTimestamp: params.beforeTimestamp,
      });
    },
  );
  const isIBANResolutionEnabled = useFeatureEnabled('IBAN_RESOLUTION');
  const detailsResult = usePaginatedQuery(
    SANCTIONS_SCREENING_DETAILS(params),
    async (paginationParams) => {
      const result = await api.getSanctionsScreeningActivityDetails({
        page: params.page,
        pageSize: params.pageSize,
        from: params.from,
        filterEntities: params.entity,
        filterName: params.name,
        filterIsHit: params.isHit,
        filterIsOngoingScreening: params.isOngoingScreening,
        filterIsNew: params.isNew,
        afterTimestamp: params.afterTimestamp,
        beforeTimestamp: params.beforeTimestamp,
        ...paginationParams,
      });
      return {
        items: result.data,
        total: result.total,
      };
    },
  );
  const { ruleInstances } = useRules();
  const detailsColumns: TableColumn<SanctionsScreeningDetails>[] = useMemo(() => {
    const helper = new ColumnHelper<SanctionsScreeningDetails>();
    return helper.list([
      helper.simple<'isHit'>({
        title: 'Status',
        key: 'isHit',
        filtering: true,
        type: {
          render: (isHit) => {
            return <Tag color={isHit ? 'error' : 'success'}>{isHit ? 'Hit' : 'No hit'}</Tag>;
          },
          stringify: (isHit) => (isHit ? 'Hit' : 'No hit'),
          autoFilterDataType: {
            kind: 'select',
            options: [
              {
                label: 'Hit',
                value: 'true',
              },
              {
                label: 'No hit',
                value: 'false',
              },
            ],
            mode: 'SINGLE',
            displayMode: 'list',
          },
        },
        defaultWidth: 80,
        enableResizing: false,
      }),
      helper.simple<'name'>({
        title: 'Name',
        key: 'name',
        filtering: true,
        defaultWidth: 350,
        type: {
          render: (name, { item: entity }) => (
            <Row align="middle">
              <Space>
                <Id to={`/sanctions/search/${entity.searchId}`}>{name}</Id>
                {entity.isNew ? <b>NEW</b> : null}
              </Space>
            </Row>
          ),
        },
      }),
      helper.simple<'entity'>({
        title: 'Type',
        key: 'entity',
        filtering: true,
        defaultWidth: 100,
        type: {
          render: (entity) => <>{entity ? getEntityName(entity) : '-'}</>,
          stringify: (entity) => (entity ? getEntityName(entity) : '-'),
          autoFilterDataType: {
            kind: 'select',
            options: SANCTIONS_SCREENING_ENTITYS.filter(
              (entity) => !(entity === 'IBAN' && !isIBANResolutionEnabled),
            ).map((v) => ({
              label: getEntityName(v),
              value: v,
            })),
            mode: 'MULTIPLE',
            displayMode: 'list',
          },
        },
      }),
      helper.simple<'ruleInstanceIds'>({
        title: 'Rules run',
        key: 'ruleInstanceIds',
        defaultWidth: 150,
        type: {
          render: (ruleInstanceIds) => (
            <>
              {ruleInstanceIds
                ? ruleInstanceIds.map((id) =>
                    ruleInstances[id] ? (
                      <Id to={`/rules/my-rules/${id}/read`} key={id}>
                        {id + (ruleInstances[id].ruleId ? ` (${ruleInstances[id].ruleId})` : '')}
                      </Id>
                    ) : (
                      <div>id</div>
                    ),
                  )
                : '-'}
            </>
          ),
          stringify: (ruleInstanceIds) => ruleInstanceIds?.join(',') ?? '-',
        },
      }),
      helper.simple<'isOngoingScreening'>({
        title: 'Ongoing screening',
        key: 'isOngoingScreening',
        filtering: true,
        defaultWidth: 100,
        type: {
          render: (isOngoingScreening) => <>{isOngoingScreening ? 'Yes' : 'No'}</>,
          stringify: (isOngoingScreening) => (isOngoingScreening ? 'Yes' : 'No'),
          autoFilterDataType: BOOLEAN.autoFilterDataType,
        },
      }),
      helper.derived({
        title: 'Related entities',
        value: (item) => item,
        defaultWidth: 150,
        type: {
          stringify: (item) => {
            const userIds = item?.userIds ?? [];
            const transactionIds = item?.transactionIds ?? [];
            const result: string[] = [];
            if (userIds.length > 0) {
              result.push(`Users: ${userIds.join(', ')}`);
            }
            if (transactionIds.length > 0) {
              result.push(`Transactions: ${transactionIds.join(', ')}`);
            }
            return result.join('\n');
          },
          render: (item) => {
            const links = [
              ...(item?.userIds ?? []).map((userId) => (
                <Id to={`/users/list/all/${userId}`} key={userId}>
                  {userId.slice(0, 7)}
                </Id>
              )),
              ...(item?.transactionIds ?? []).map((txId) => (
                <Id to={`/transactions/item/${txId}`} key={txId}>
                  {txId.slice(0, 7)}
                </Id>
              )),
            ];
            return (
              <>
                <div className={s.relatedEntities}>{links}</div>
              </>
            );
          },
        },
      }),
      helper.simple<'lastScreenedAt'>({
        title: 'Last screened at',
        key: 'lastScreenedAt',
        defaultWidth: 100,
        type: {
          render: (lastScreenedAt) =>
            lastScreenedAt ? <TimestampDisplay timestamp={lastScreenedAt} /> : <>-</>,
          stringify: (lastScreenedAt) =>
            lastScreenedAt ? new Date(lastScreenedAt).toISOString() : '-',
        },
      }),
      helper.simple<'isNew'>({
        title: 'New',
        key: 'isNew',
        hideInTable: true,
        filtering: true,
        exporting: true,
        type: {
          stringify: (isNew) => (isNew ? 'Yes' : 'No'),
          autoFilterDataType: BOOLEAN.autoFilterDataType,
        },
      }),
    ]);
  }, [ruleInstances, isIBANResolutionEnabled]);

  return (
    <>
      <div className={s.datePicker}>
        <DatePicker.RangePicker
          value={[dayjs(params.afterTimestamp), dayjs(params.beforeTimestamp)]}
          onChange={(range) => {
            if (!range) {
              setParams((prevState) => ({
                ...prevState,
                ...DEFAULT_DATE_RANGE_PARAMS,
              }));
              return;
            }
            setParams((prevState) => ({
              ...prevState,
              afterTimestamp: range?.[0]?.valueOf(),
              beforeTimestamp: range?.[1]?.valueOf(),
            }));
          }}
        />
      </div>
      <AsyncResourceRenderer resource={statsResult.data}>
        {(response) => {
          const emptyState: SanctionsScreeningEntityStats = { screenedCount: 0, hitCount: 0 };
          const user = response.data?.find((v) => v.entity === 'USER');
          const bank = response.data?.find((v) => v.entity === 'BANK');
          const iban = isIBANResolutionEnabled
            ? response.data?.find((v) => v.entity === 'IBAN')
            : undefined;
          const externalUser = response.data?.find((v) => v.entity === 'EXTERNAL_USER');
          return (
            <div className={s.root}>
              <KpiCard data={user ?? emptyState} title="Users" className={s['user']} />
              <KpiCard data={bank ?? emptyState} title="Bank names" className={s['bank']} />
              {isIBANResolutionEnabled && (
                <KpiCard data={iban ?? emptyState} title="IBAN" className={s['iban']} />
              )}
              <KpiCard
                data={externalUser ?? emptyState}
                title="Transaction counterparty"
                className={s['counterPartyUser']}
              />
            </div>
          );
        }}
      </AsyncResourceRenderer>
      <QueryResultsTable<SanctionsScreeningDetails, TableSearchParams>
        tableId={'sanctions-screening-details'}
        pagination={true}
        rowKey="name"
        queryResults={detailsResult}
        columns={detailsColumns}
        fitHeight={true}
        params={params}
        onChangeParams={(params) => {
          setParams(params);
        }}
        rowHeightMode={'AUTO'}
        toolsOptions={{
          reload: true,
          download: true,
          setting: true,
        }}
        leftTools={[]}
      />
    </>
  );
};
