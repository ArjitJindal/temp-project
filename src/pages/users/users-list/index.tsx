import { Tabs } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import styles from './UsersList.module.less';
import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { getAllUserColumns } from './all-user-columns';
import { RiskLevelButton } from './RiskLevelFilterButton';
import { dayjs } from '@/utils/dayjs';
import RiskLevelTag from '@/components/ui/RiskLevelTag';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { InternalBusinessUser, InternalConsumerUser, InternalUser } from '@/apis';
import PageWrapper from '@/components/PageWrapper';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import { TableColumn } from '@/components/ui/Table/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { USERS } from '@/utils/queries/keys';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { TableSearchParams } from '@/pages/case-management/types';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';

const BusinessUsersTab = () => {
  usePageViewTracker('Users List - Business');
  const api = useApi();
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const measure = useApiTime();
  const columns: TableColumn<InternalBusinessUser>[] = getBusinessUserColumns();
  if (isPulseEnabled) {
    columns.push({
      title: 'Risk Level',
      dataIndex: 'labels',
      exportData: (entity) => {
        return entity?.drsScore?.manualRiskLevel || entity?.drsScore?.derivedRiskLevel || '-';
      },
      tip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
      search: false,
      render: (dom, entity) => {
        if (entity?.drsScore?.manualRiskLevel || entity?.drsScore?.derivedRiskLevel) {
          return (
            <RiskLevelTag
              level={entity?.drsScore?.manualRiskLevel || entity?.drsScore?.derivedRiskLevel}
            />
          );
        }
        return '-';
      },
    });
  }

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);

  const bussinessResult = usePaginatedQuery(
    USERS('bussiness', params),
    async (paginationParams) => {
      const { createdTimestamp, userId, page, riskLevels, pageSize } = params;

      const response = await measure(
        () =>
          api.getBusinessUsersList({
            page,
            pageSize,
            ...paginationParams,
            afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
            beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : Date.now(),
            filterId: userId,
            filterRiskLevel: riskLevels,
          }),
        'Get Business Users List',
      );

      return {
        items: response.data,
        total: response.total,
      };
    },
  );

  return (
    <>
      <QueryResultsTable<InternalBusinessUser, TableSearchParams>
        form={{
          labelWrap: true,
        }}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        actionsHeader={[
          ({ params, setParams }) => {
            return (
              <>
                <UserSearchButton
                  initialMode={'ALL'}
                  userId={params.userId ?? null}
                  showOriginAndDestination={false}
                  onConfirm={(userId, mode) => {
                    setParams((state) => ({
                      ...state,
                      userId: userId ?? undefined,
                      userFilterMode: mode ?? undefined,
                    }));
                  }}
                />
                <RiskLevelButton
                  riskLevels={params.riskLevels ?? []}
                  onConfirm={(riskLevels) => {
                    setParams((state) => ({
                      ...state,
                      riskLevels: riskLevels ?? undefined,
                    }));
                  }}
                />
              </>
            );
          },
        ]}
        className={styles.table}
        scroll={{ x: 1300 }}
        params={params}
        onChangeParams={setParams}
        columns={columns}
        queryResults={bussinessResult}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list-table',
        }}
        autoAdjustHeight
      />
    </>
  );
};

const ConsumerUsersTab = () => {
  usePageViewTracker('Users List - Consumer');
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const api = useApi();
  const measure = useApiTime();
  const columns: TableColumn<InternalConsumerUser>[] = getConsumerUserColumns();
  {
    if (isPulseEnabled) {
      columns.push({
        title: 'Risk Level',
        dataIndex: 'labels',
        exportData: (entity) => {
          return entity?.drsScore?.manualRiskLevel || entity?.drsScore?.derivedRiskLevel || '-';
        },
        tip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
        search: false,
        render: (dom, entity) => {
          if (entity?.drsScore?.manualRiskLevel || entity?.drsScore?.derivedRiskLevel) {
            return (
              <RiskLevelTag
                level={entity.drsScore.manualRiskLevel || entity.drsScore.derivedRiskLevel}
              />
            );
          }
          return '-';
        },
      });
    }
  }

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
  const consumerResults = usePaginatedQuery(USERS('consumer', params), async (paginationParams) => {
    const { userId, createdTimestamp, page, riskLevels, pageSize } = params;

    const response = await measure(
      () =>
        api.getConsumerUsersList({
          page,
          pageSize,
          ...paginationParams,
          afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
          beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : Date.now(),
          filterId: userId,
          filterRiskLevel: riskLevels,
        }),
      'Get Consumer Users List',
    );

    return {
      items: response.data,
      total: response.total,
    };
  });

  return (
    <>
      <QueryResultsTable<InternalConsumerUser, AllParams<TableSearchParams>>
        form={{
          labelWrap: true,
        }}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        params={params}
        onChangeParams={setParams}
        actionsHeader={[
          ({ params, setParams }) => {
            return (
              <>
                <UserSearchButton
                  initialMode={'ALL'}
                  userId={params.userId ?? null}
                  showOriginAndDestination={false}
                  onConfirm={(userId, mode) => {
                    setParams((state) => ({
                      ...state,
                      userId: userId ?? undefined,
                      userFilterMode: mode ?? undefined,
                    }));
                  }}
                />
                <RiskLevelButton
                  riskLevels={params.riskLevels ?? []}
                  onConfirm={(riskLevels) => {
                    setParams((state) => ({
                      ...state,
                      riskLevels: riskLevels ?? undefined,
                    }));
                  }}
                />
              </>
            );
          },
        ]}
        className={styles.table}
        scroll={{ x: 500 }}
        columns={columns}
        queryResults={consumerResults}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list',
        }}
        autoAdjustHeight
      />
    </>
  );
};

const AllUsersTab = () => {
  const api = useApi();
  usePageViewTracker('Users List - All');
  const columns: TableColumn<InternalUser>[] = getAllUserColumns();
  const isPulseEnabled = useFeatureEnabled('PULSE');
  if (isPulseEnabled) {
    columns.push({
      title: 'Risk Level',
      exportData: (entity) => {
        return entity?.drsScore?.manualRiskLevel || entity?.drsScore?.derivedRiskLevel || '-';
      },
      hideInSearch: true,
      tip: 'Risk level of user.',
      width: 180,
      render: (dom, entity) => {
        if (entity?.drsScore?.manualRiskLevel || entity?.drsScore?.derivedRiskLevel) {
          return (
            <RiskLevelTag
              level={entity.drsScore.manualRiskLevel || entity.drsScore.derivedRiskLevel}
            />
          );
        }
        return '-';
      },
    });
  }

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);

  const measure = useApiTime();
  const allUsersResult = usePaginatedQuery(USERS('all', params), async (paginationParams) => {
    const { userId, createdTimestamp, page, riskLevels, pageSize } = params;

    const response = await measure(
      () =>
        api.getAllUsersList({
          page,
          pageSize,
          ...paginationParams,
          afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
          beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : Date.now(),
          filterId: userId,
          filterRiskLevel: riskLevels,
        }),
      'Get All Users List',
    );

    return {
      items: response.data,
      total: response.total,
    };
  });

  return (
    <>
      <QueryResultsTable<InternalUser, AllParams<TableSearchParams>>
        form={{
          labelWrap: true,
        }}
        rowKey="userId"
        search={{
          labelWidth: 120,
        }}
        actionsHeader={[
          ({ params, setParams }) => {
            return (
              <>
                <UserSearchButton
                  initialMode={'ALL'}
                  userId={params.userId ?? null}
                  showOriginAndDestination={false}
                  onConfirm={(userId, mode) => {
                    setParams((state) => ({
                      ...state,
                      userId: userId ?? undefined,
                      userFilterMode: mode ?? undefined,
                    }));
                  }}
                />
                <RiskLevelButton
                  riskLevels={params.riskLevels ?? []}
                  onConfirm={(riskLevels) => {
                    setParams((state) => ({
                      ...state,
                      riskLevels: riskLevels ?? undefined,
                    }));
                  }}
                />
              </>
            );
          },
        ]}
        className={styles.table}
        scroll={{ x: 500 }}
        columns={columns}
        queryResults={allUsersResult}
        params={params}
        onChangeParams={setParams}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'users-list',
        }}
        autoAdjustHeight
      />
    </>
  );
};

export default function UsersList() {
  const { list = 'consumer' } = useParams<'list' | 'id'>();
  const navigate = useNavigate();
  const i18n = useI18n();
  const [_, setLocalStorageActiveTab] = useLocalStorageState('user-active-tab', list);
  useEffect(() => {
    setLocalStorageActiveTab(list);
  }, [setLocalStorageActiveTab, list]);
  return (
    <PageWrapper title={i18n('menu.users.lists')}>
      <PageTabs
        activeKey={list}
        onChange={(key) => {
          navigate(makeUrl(`/users/list/:list/all`, { list: key }), { replace: true });
        }}
      >
        <Tabs.TabPane tab={'All Users'} key="all">
          <AllUsersTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Consumer Users" key="consumer">
          <ConsumerUsersTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Business Users" key="business">
          <BusinessUsersTab />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
}
