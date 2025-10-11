import { useMemo, useState } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router';
import { BreadcrumbItem } from '../library/Breadcrumbs';
import s from './index.module.less';
import RiskClassificationLink from './LinkComponents/RiskClassificationLink';
import RiskFactorLink from './LinkComponents/RiskFactorLink';
import { BreadCrumbsWrapper, SimulationStorageKey } from '@/components/BreadCrumbsWrapper';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { useVersionHistory } from '@/hooks/api/version-history';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { VersionHistory, VersionHistoryType } from '@/apis';
import { DATE_TIME, STRING } from '@/components/library/Table/standardDataTypes';
import { useUsers } from '@/utils/user-utils';
import AccountTag from '@/components/AccountTag';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import { AccountsFilter } from '@/components/library/AccountsFilter';

interface TableParams extends CommonParams {
  id?: string;
  createdBy?: string[];
  createdAt?: number[];
}

type MetaData = {
  breadcrumbs: BreadcrumbItem[];
  simulationStorageKey: SimulationStorageKey;
  simulationHistoryUrl: string;
  simulationDefaultUrl: string;
  nonSimulationDefaultUrl: string;
  idComponent: (versionId: string) => React.ReactNode;
  versionHistoryUrl: string;
};

const getMetaData = (type: VersionHistoryType): MetaData => {
  switch (type) {
    case 'RiskClassification':
      return {
        breadcrumbs: [
          { title: 'Risk scoring', to: '/risk-levels/risk-factors/consumer' },
          { title: 'Risk levels', to: '/risk-levels/configure' },
          { title: 'Version history', to: '/risk-levels/version-history' },
        ],
        simulationStorageKey: 'SIMULATION_RISK_LEVELS',
        simulationHistoryUrl: '/risk-levels/simulation-history',
        simulationDefaultUrl: '/risk-levels/simulation',
        nonSimulationDefaultUrl: '/risk-levels/risk-factors/version-history',
        idComponent: (value) => <RiskClassificationLink versionId={value} />,
        versionHistoryUrl: '/risk-levels/version-history',
      };
    case 'RiskFactors':
      return {
        breadcrumbs: [
          { title: 'Risk scoring', to: '/risk-levels/risk-factors/consumer' },
          { title: 'Risk factors', to: '/risk-levels/risk-factors' },
          { title: 'Version history', to: '/risk-levels/risk-factors/version-history' },
        ],
        simulationStorageKey: 'SIMULATION_CUSTOM_RISK_FACTORS',
        simulationHistoryUrl: '/risk-levels/risk-factors/simulation-history',
        simulationDefaultUrl: '/risk-levels/risk-factors/simulation',
        nonSimulationDefaultUrl: '/risk-levels/risk-factors/version-history',
        idComponent: (value) => <RiskFactorLink versionId={value} />,
        versionHistoryUrl: '/risk-levels/risk-factors/version-history',
      };
  }
};

export default function RiskLevelsVersionHistoryPage() {
  const pathname = useLocation().pathname;

  const type: VersionHistoryType = useMemo(() => {
    if (pathname === '/risk-levels/version-history') {
      return 'RiskClassification';
    } else if (pathname === '/risk-levels/risk-factors/version-history') {
      return 'RiskFactors';
    }
    throw new Error('Invalid pathname');
  }, [pathname]);

  const metaData = useMemo(() => getMetaData(type), [type]);

  const [params, setParams] = useState<TableParams>(DEFAULT_PARAMS_STATE);
  const queryResults = useVersionHistory(type, params);

  const [users] = useUsers();
  const helper = new ColumnHelper<VersionHistory>();

  const columns: TableColumn<VersionHistory>[] = helper.list([
    helper.simple<'id'>({
      key: 'id',
      title: 'Version ID',
      type: {
        render: (value) => <div className={s.versionId}>{metaData.idComponent(value ?? '')}</div>,
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
      breadcrumbs={metaData.breadcrumbs}
      simulationStorageKey={metaData.simulationStorageKey}
      simulationHistoryUrl={metaData.simulationHistoryUrl}
      simulationDefaultUrl={metaData.simulationDefaultUrl}
      nonSimulationDefaultUrl={metaData.nonSimulationDefaultUrl}
      versionHistory={{
        url: metaData.versionHistoryUrl,
      }}
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
