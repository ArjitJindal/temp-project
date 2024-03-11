import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { getAllUserColumns } from './all-user-columns';
import { RiskLevelButton } from './RiskLevelFilterButton';
import { queryAdapter } from './helpers/queryAdapter';
import { UserRegistrationStatusFilterButton } from './UserRegistrationStatusFilterButton';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { InternalUser, RiskLevel, UserRegistrationStatus } from '@/apis';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { USERS } from '@/utils/queries/keys';
import { PaginatedData, usePaginatedQuery } from '@/utils/queries/hooks';
import { useDeepEqualEffect } from '@/utils/hooks';
import UserTagSearchButton from '@/pages/transactions/components/UserTagSearchButton';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { BOOLEAN, DATE, FLOAT, RISK_LEVEL } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { ExtraFilterProps } from '@/components/library/Filter/types';

export interface UserSearchParams extends CommonParams {
  riskLevels?: RiskLevel[];
  userId?: string;
  tagKey?: string;
  tagValue?: string;
  createdTimestamp?: string[];
  userRegistrationStatus?: UserRegistrationStatus[];
  riskLevelLocked?: 'true' | 'false';
}

function getRiskScoringColumns(): TableColumn<InternalUser>[] {
  const helper = new ColumnHelper<InternalUser>();

  return helper.list([
    helper.derived<RiskLevel>({
      title: 'CRA risk level',
      type: RISK_LEVEL,
      tooltip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
      value: (entity): RiskLevel | undefined => {
        return entity?.drsScore?.manualRiskLevel ?? entity?.drsScore?.derivedRiskLevel;
      },
    }),
    helper.simple<'drsScore.drsScore'>({
      key: 'drsScore.drsScore',
      title: 'CRA risk score',
      type: FLOAT,
      tooltip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
    }),
    helper.simple<'drsScore.isUpdatable'>({
      key: 'drsScore.isUpdatable',
      title: 'Is locked',
      type: {
        render: (value) => <>{!value ? 'Yes' : 'No'}</>,
      },
      tooltip: 'Whether customer risk assessment score is locked',
    }),
    helper.simple<'krsScore.riskLevel'>({
      key: 'krsScore.riskLevel',
      title: 'KRS risk level',
      type: RISK_LEVEL,
      tooltip: 'Know your customer - accounts for KYC Risk Level',
    }),
    helper.simple<'krsScore.krsScore'>({
      key: 'krsScore.krsScore',
      title: 'KRS risk score',
      type: FLOAT,
      tooltip: 'Know your customer - accounts for KYC Risk Score',
    }),
  ]);
}

const extraFilters = (
  list: 'business' | 'consumer' | 'all',
): ExtraFilterProps<UserSearchParams>[] => {
  const extraFilters: ExtraFilterProps<UserSearchParams>[] = [
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
        <UserTagSearchButton
          initialState={{
            key: params.tagKey,
            value: params.tagValue,
          }}
          onConfirm={(value) => {
            setParams((state) => ({
              ...state,
              tagKey: value.key,
              tagValue: value.value,
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
    {
      key: 'riskLevelLocked',
      title: 'CRA lock status',
      renderer: BOOLEAN.autoFilterDataType,
    },
  ];

  if (list === 'business') {
    extraFilters.push({
      key: 'userRegistrationStatus',
      title: 'Registration Status',
      renderer: ({ params, setParams, onUpdateFilterClose }) => (
        <UserRegistrationStatusFilterButton
          userRegistrationStatus={params.userRegistrationStatus ?? []}
          onConfirm={(registrationStatus) => {
            setParams((state) => ({
              ...state,
              userRegistrationStatus: registrationStatus ?? undefined,
            }));
          }}
          onUpdateFilterClose={onUpdateFilterClose}
        />
      ),
    });
  }

  return extraFilters;
};

function getLastUpdatedColumn(): TableColumn<InternalUser> {
  const helper = new ColumnHelper<InternalUser>();
  return helper.simple<'updatedAt'>({
    key: 'updatedAt',
    title: 'Last updated',
    sorting: true,
    type: DATE,
  });
}

const UsersTab = (props: { type: 'business' | 'consumer' | 'all' }) => {
  const type = props.type;

  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const api = useApi();
  const navigate = useNavigate();

  const columns: TableColumn<InternalUser>[] =
    type === 'business'
      ? (getBusinessUserColumns() as TableColumn<InternalUser>[])
      : type === 'consumer'
      ? (getConsumerUserColumns() as TableColumn<InternalUser>[])
      : (getAllUserColumns() as TableColumn<InternalUser>[]);

  if (isRiskScoringEnabled) {
    columns.push(...getRiskScoringColumns());
  }
  columns.push(getLastUpdatedColumn());
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
    async (paginationParams): Promise<PaginatedData<InternalUser>> => {
      const {
        userId,
        createdTimestamp,
        page,
        riskLevels,
        pageSize,
        tagKey,
        tagValue,
        sort,
        riskLevelLocked,
      } = params;

      const queryObj = {
        page,
        pageSize,
        ...paginationParams,
        afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
        beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : Date.now(),
        filterId: userId,
        filterTagKey: tagKey,
        filterTagValue: tagValue,
        filterRiskLevel: riskLevels,
        ...(type === 'business' && {
          filterUserRegistrationStatus: params.userRegistrationStatus,
        }),
        sortField: sort[0]?.[0] ?? 'createdTimestamp',
        sortOrder: sort[0]?.[1] ?? 'descend',
        filterRiskLevelLocked: riskLevelLocked,
      };

      const response =
        type === 'business'
          ? await api.getBusinessUsersList(queryObj)
          : type === 'consumer'
          ? await api.getConsumerUsersList(queryObj)
          : await api.getAllUsersList(queryObj);

      return {
        items: response.data as InternalUser[],
        total: response.total,
      };
    },
  );

  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<InternalUser, UserSearchParams>
        tableId={`users-list/${type}`}
        rowKey={'userId'}
        extraFilters={extraFilters(type)}
        columns={columns}
        queryResults={queryResults}
        params={params}
        onChangeParams={handleChangeParams}
        fitHeight={true}
        pagination={true}
      />
    </PageWrapperContentContainer>
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
        items={[
          { title: 'All users', key: 'all', children: <UsersTab type={list} /> },
          { title: 'Consumer users', key: 'consumer', children: <UsersTab type={list} /> },
          { title: 'Business users', key: 'business', children: <UsersTab type={list} /> },
        ]}
      />
    </PageWrapper>
  );
}
