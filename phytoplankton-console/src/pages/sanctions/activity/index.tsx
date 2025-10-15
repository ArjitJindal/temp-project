import { useMemo } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import { KpiCard } from './KpiCard';
import { useApi } from '@/api';
import { SANCTIONS_SCREENING_DETAILS, SANCTIONS_SCREENING_STATS } from '@/utils/queries/keys';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  BooleanString,
  SanctionsScreeningDetails,
  SanctionsScreeningEntity,
  SanctionsScreeningEntityStats,
} from '@/apis';
import { AllParams, TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Tag from '@/components/library/Tag';
import Id from '@/components/ui/Id';
import { useRules } from '@/utils/rules';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { SANCTIONS_SCREENING_ENTITYS } from '@/apis/models-custom/SanctionsScreeningEntity';
import { BOOLEAN } from '@/components/library/Table/standardDataTypes';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

type TableSearchParams = AllParams<{
  entity?: SanctionsScreeningEntity[];
  isHit?: BooleanString;
  isNew?: BooleanString;
  name?: string;
  afterTimestamp?: number;
  beforeTimestamp?: number;
}>;

function getEntityName(entity: SanctionsScreeningEntity, userAlias?: string) {
  switch (entity) {
    case 'USER':
      return firstLetterUpper(userAlias);
    case 'BANK':
      return 'Bank name';
    case 'IBAN':
      return 'IBAN';
    case 'EXTERNAL_USER':
      return 'Transaction counterparty';
  }
}

export const SanctionsScreeningActivity = ({ params, setParams }) => {
  const api = useApi({ debounce: 500 });
  const settings = useSettings();
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
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
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
            <div className={s.nameContainer}>
              <div className={s.nameContent}>
                {!hasFeatureDowJones || entity.isHit ? (
                  <Id to={`/screening/manual-screening/${entity.searchId}`}>{name}</Id>
                ) : (
                  <div>{name}</div>
                )}
                {entity.isNew ? <b>NEW</b> : null}
              </div>
            </div>
          ),
        },
      }),
      helper.simple<'entity'>({
        title: 'Type',
        key: 'entity',
        filtering: true,
        defaultWidth: 100,
        type: {
          render: (entity) => <>{entity ? getEntityName(entity, settings.userAlias) : '-'}</>,
          stringify: (entity) => (entity ? getEntityName(entity, settings.userAlias) : '-'),
          autoFilterDataType: {
            kind: 'select',
            options: SANCTIONS_SCREENING_ENTITYS.map((v) => ({
              label: getEntityName(v, settings.userAlias),
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
                      <div key={id}>id</div>
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
        hideInTable: true,
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
        sorting: true,
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
  }, [ruleInstances, hasFeatureDowJones, settings.userAlias]);

  return (
    <>
      <AsyncResourceRenderer resource={statsResult.data}>
        {(response) => {
          const emptyState: SanctionsScreeningEntityStats = { screenedCount: 0, hitCount: 0 };
          const user = response.data?.find((v) => v.entity === 'USER');
          const bank = response.data?.find((v) => v.entity === 'BANK');
          const externalUser = response.data?.find((v) => v.entity === 'EXTERNAL_USER');
          return (
            <div className={s.root}>
              <KpiCard
                data={user ?? emptyState}
                title={`${firstLetterUpper(settings.userAlias)}s`}
                className={s['user']}
              />
              <KpiCard data={bank ?? emptyState} title="Bank names" className={s['bank']} />
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
        rowKey="searchId"
        queryResults={detailsResult}
        columns={detailsColumns}
        fitHeight={true}
        params={params}
        onChangeParams={(params) => {
          setParams(params);
        }}
        rowHeightMode={'AUTO'}
        clientSideSorting={true}
        toolsOptions={{
          reload: true,
          download: true,
          setting: true,
        }}
      />
    </>
  );
};
