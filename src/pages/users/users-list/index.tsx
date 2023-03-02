import { Tabs } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import styles from './UsersList.module.less';
import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { getAllUserColumns } from './all-user-columns';
import { RiskLevelButton } from './RiskLevelFilterButton';
import { queryAdapter } from './helpers/queryAdapter';
import { dayjs } from '@/utils/dayjs';
import RiskLevelTag from '@/components/ui/RiskLevelTag';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { InternalBusinessUser, InternalConsumerUser, InternalUser, RiskLevel } from '@/apis';
import PageWrapper from '@/components/PageWrapper';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { TableColumn } from '@/components/ui/Table/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { USERS } from '@/utils/queries/keys';
import { PaginatedData, usePaginatedQuery } from '@/utils/queries/hooks';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useDeepEqualEffect } from '@/utils/hooks';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';

export interface UserSearchParams extends CommonParams {
  riskLevels?: RiskLevel[];
  userId?: string;
  tagKey?: string;
  tagValue?: string;
  createdTimestamp?: string[];
}

function getPulseColumns<
  T extends InternalBusinessUser | InternalConsumerUser | InternalUser,
>(): TableColumn<T>[] {
  return [
    {
      title: 'CRA Risk Level',
      dataIndex: 'drsRiskLevel',
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
      width: 150,
      hideInSearch: true,
    },
    {
      title: 'CRA Risk Score',
      dataIndex: 'drsScore',
      exportData: (entity) => {
        return entity?.drsScore?.drsScore ?? '-';
      },
      tip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
      search: false,
      render: (dom, entity) => {
        if (entity?.drsScore?.drsScore == null) {
          return <span>{entity?.drsScore?.drsScore}</span>;
        }
        return <span>{entity?.drsScore?.drsScore.toFixed(2)}</span>;
      },
      width: 150,
      hideInSearch: true,
    },
    {
      title: 'Is Locked',
      dataIndex: 'drsScore.isUpdatable',
      exportData: (entity) => {
        return !entity?.drsScore?.isUpdatable ? 'Yes' : 'No';
      },
      tip: 'Customer risk assessment score is locked',
      search: false,
      render: (dom, entity) => {
        if (!entity?.drsScore?.isUpdatable) {
          return <span>Yes</span>;
        }
        return <span>No</span>;
      },
      width: 150,
      hideInSearch: true,
    },
    {
      title: 'KRS Risk Level',
      dataIndex: 'krsRiskLevel',
      exportData: (entity) => {
        return entity?.krsScore?.riskLevel || '-';
      },
      tip: 'Know your customer - accounts for KYC Risk Level',
      search: false,
      render: (dom, entity) => {
        if (entity?.krsScore?.riskLevel) {
          return <RiskLevelTag level={entity?.krsScore?.riskLevel} />;
        }

        return '-';
      },
      width: 150,
      hideInSearch: true,
    },
    {
      title: 'KRS Risk Score',
      dataIndex: 'krsScore',
      exportData: (entity) => {
        return entity?.krsScore?.krsScore ?? '-';
      },
      tip: 'Know your customer - accounts for KYC Risk Score',
      search: false,
      render: (dom, entity) => {
        if (entity?.krsScore?.krsScore == null) {
          return <span>{entity?.krsScore?.krsScore}</span>;
        }
        return <span>{entity?.krsScore?.krsScore.toFixed(2)}</span>;
      },
      width: 150,
      hideInSearch: true,
    },
  ];
}

const UsersTab = <T extends InternalBusinessUser | InternalConsumerUser | InternalUser>(props: {
  type: 'business' | 'consumer' | 'all';
}) => {
  const type = props.type;
  usePageViewTracker(`Users List - ${type}`);

  const isPulseEnabled = useFeatureEnabled('PULSE');
  const api = useApi();
  const measure = useApiTime();
  const navigate = useNavigate();

  const columns: TableColumn<T>[] =
    type === 'business'
      ? (getBusinessUserColumns() as TableColumn<T>[])
      : type === 'consumer'
      ? (getConsumerUserColumns() as TableColumn<T>[])
      : (getAllUserColumns() as TableColumn<T>[]);

  if (isPulseEnabled) {
    columns.push(...getPulseColumns<T>());
  }

  const [params, setParams] = useState<UserSearchParams>(DEFAULT_PARAMS_STATE);
  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));

  const pushParamsToNavigation = useCallback(
    (params: UserSearchParams) => {
      navigate(makeUrl('/users/list/:list/all', { list: type }, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate, type],
  );

  const handleChangeParams = (newParams: UserSearchParams) => {
    pushParamsToNavigation(newParams);
  };

  useDeepEqualEffect(() => {
    setParams((prevState: UserSearchParams) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PAGE_SIZE,
    }));
  }, [parsedParams]);

  const queryResults = usePaginatedQuery(
    USERS(type, params),
    async (paginationParams): Promise<PaginatedData<T>> => {
      const { userId, createdTimestamp, page, riskLevels, pageSize } = params;
      const queryObj = {
        page,
        pageSize,
        ...paginationParams,
        afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
        beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : Date.now(),
        filterId: userId,
        filterRiskLevel: riskLevels,
      };

      const response =
        type === 'business'
          ? await measure(() => api.getBusinessUsersList(queryObj), `Get Business Users List`)
          : type === 'consumer'
          ? await measure(() => api.getConsumerUsersList(queryObj), `Get Consumer Users List`)
          : await measure(() => api.getAllUsersList(queryObj), `Get Users List`);

      return {
        items: response.data as T[],
        total: response.total,
      };
    },
  );

  return (
    <QueryResultsTable<T, UserSearchParams>
      tableId={'users-list'}
      form={{
        labelWrap: true,
      }}
      rowKey="userId"
      search={{
        labelWidth: 120,
      }}
      extraFilters={[
        {
          key: 'userId',
          title: 'User ID/Name',
          renderer: ({ params, setParams }) => (
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
          ),
        },
        {
          key: 'tagKey',
          title: 'Tags',
          renderer: ({ params, setParams }) => (
            <TagSearchButton
              initialState={{
                key: params.tagKey ?? null,
                value: params.tagValue ?? null,
              }}
              onConfirm={(value) => {
                setParams((state) => ({
                  ...state,
                  tagKey: value.key ?? undefined,
                  tagValue: value.value ?? undefined,
                }));
              }}
            />
          ),
        },
        {
          key: 'riskLevels',
          title: 'CRA',
          renderer: ({ params, setParams }) => (
            <RiskLevelButton
              riskLevels={params.riskLevels ?? []}
              onConfirm={(riskLevels) => {
                setParams((state) => ({
                  ...state,
                  riskLevels: riskLevels ?? undefined,
                }));
              }}
            />
          ),
        },
      ]}
      className={styles.table}
      scroll={{ x: 500 }}
      columns={columns}
      queryResults={queryResults}
      params={params}
      onChangeParams={handleChangeParams}
      columnsState={{
        persistenceType: 'localStorage',
        persistenceKey: 'users-list',
      }}
      autoAdjustHeight
    />
  );
};

export default function UsersList() {
  const { list = 'consumer' } = useParams<'list' | 'id'>() as {
    list: 'business' | 'consumer' | 'all';
  };
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
          <UsersTab<InternalUser> type={list} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Consumer Users" key="consumer">
          <UsersTab<InternalConsumerUser> type={list} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Business Users" key="business">
          <UsersTab<InternalBusinessUser> type={list} />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
}
