import { useState } from 'react';
import { UserOutlined } from '@ant-design/icons';
import s from './index.module.less';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { RISK_LEVELS_VERSION_HISTORY } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { RiskClassificationHistory } from '@/apis';
import { DATE_TIME, STRING } from '@/components/library/Table/standardDataTypes';
import Link from '@/components/ui/Link';
import { useUsers } from '@/utils/user-utils';
import AccountTag from '@/components/AccountTag';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import Tag from '@/components/library/Tag';
import { useRiskClassificationConfig } from '@/utils/risk-levels';
import { AccountsFilter } from '@/components/library/AccountsFilter';

interface TableParams extends CommonParams {
  id?: string;
  createdBy?: string[];
  createdAt?: number[];
}

export default function RiskLevelsVersionHistoryPage() {
  const api = useApi();
  const [params, setParams] = useState<TableParams>(DEFAULT_PARAMS_STATE);
  const queryResults = usePaginatedQuery(
    RISK_LEVELS_VERSION_HISTORY(params),
    async (pageParams) => {
      return await api.getRiskLevelVersionHistory({
        ...pageParams,
        page: pageParams.page || params.page,
        pageSize: pageParams.pageSize || params.pageSize,
        filterVersionId: params.id,
        filterCreatedBy: params.createdBy,
        filterAfterTimestamp: params.createdAt?.[0] ?? undefined,
        filterBeforeTimestamp: params.createdAt?.[1] ?? undefined,
        sortField: params?.sort?.[0]?.[0] ?? 'createdAt',
        sortOrder: params?.sort?.[0]?.[1] ?? 'descend',
      });
    },
  );
  const [users] = useUsers();
  const helper = new ColumnHelper<RiskClassificationHistory>();
  const riskClassifcationConfig = useRiskClassificationConfig();
  const columns: TableColumn<RiskClassificationHistory>[] = helper.list([
    helper.simple<'id'>({
      key: 'id',
      title: 'Version ID',
      type: {
        render: (value) => (
          <div className={s.versionId}>
            <Link to={`/risk-levels/version-history/${value}`}>{value}</Link>
            {riskClassifcationConfig.data.id === value && <Tag color="green">Active</Tag>}
          </div>
        ),
        stringify: (value) => value ?? '',
      },
      sorting: true,
      filtering: true,
    }),
    helper.simple<'comment'>({
      key: 'comment',
      title: 'Comment',
      type: STRING,
      defaultWidth: 200,
    }),
    helper.simple<'createdAt'>({
      key: 'createdAt',
      title: 'Created at',
      type: DATE_TIME,
      sorting: true,
      filtering: true,
    }),
    helper.simple<'createdBy'>({
      key: 'createdBy',
      title: 'Created by',
      type: {
        stringify: (value) => {
          return `${value === undefined ? '' : users[value]?.name ?? value}`;
        },
        render: (userId, _) => {
          return userId ? <AccountTag accountId={userId} /> : <>-</>;
        },
      },
    }),
  ]);

  return (
    <BreadCrumbsWrapper
      breadcrumbs={[
        { title: 'Risk scoring', to: '/risk-levels/risk-factors/consumer' },
        { title: 'Risk levels', to: '/risk-levels/configure' },
        { title: 'Version history', to: '/risk-levels/version-history' },
      ]}
      simulationStorageKey="SIMULATION_RISK_LEVELS"
      simulationHistoryUrl="/risk-levels/version-history"
      simulationDefaultUrl="/risk-levels/configure"
      nonSimulationDefaultUrl="/risk-levels/version-history"
    >
      <PageWrapperContentContainer>
        <QueryResultsTable
          queryResults={queryResults}
          showResultsInfo={false}
          retainSelectedIds={false}
          rowKey="id"
          params={params}
          onChangeParams={setParams}
          columns={columns}
          fitHeight
          extraFilters={[
            {
              key: 'createdBy',
              title: 'Created by',
              renderer: ({ params, setParams, onUpdateFilterClose }) => (
                <AccountsFilter
                  title="Created by"
                  Icon={<UserOutlined />}
                  users={params.createdBy ?? []}
                  onConfirm={(value) => {
                    setParams((state) => ({
                      ...state,
                      createdBy: value ?? undefined,
                    }));
                  }}
                  onUpdateFilterClose={onUpdateFilterClose}
                />
              ),
            },
          ]}
        />
      </PageWrapperContentContainer>
    </BreadCrumbsWrapper>
  );
}
