import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import { queryAdapter } from './helpers/queryAdapter';
import { UsersTable } from './users-table';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { InternalUser, RiskLevel, UserRegistrationStatus } from '@/apis';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { CommonParams } from '@/components/library/Table/types';
import { USERS } from '@/utils/queries/keys';
import { useCursorQuery, usePaginatedQuery } from '@/utils/queries/hooks';
import { useDeepEqualEffect } from '@/utils/hooks';
import { DEFAULT_PAGE_SIZE } from '@/components/library/Table/consts';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface UserSearchParams extends CommonParams {
  isPepHit?: 'true' | 'false';
  riskLevels?: RiskLevel[];
  userId?: string;
  tagKey?: string;
  tagValue?: string;
  createdTimestamp?: string[];
  userRegistrationStatus?: UserRegistrationStatus[];
  riskLevelLocked?: 'true' | 'false';
}

const UsersTab = (props: { type: 'business' | 'consumer' | 'all' }) => {
  const type = props.type;

  const api = useApi();
  const navigate = useNavigate();

  const [params, setParams] = useState<UserSearchParams>({ sort: [], pageSize: 20 });
  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');
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
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PAGE_SIZE,
      from: parsedParams.from,
      page: parsedParams.page,
    }));
  }, [parsedParams]);

  const queryResults = useCursorQuery<InternalUser>(USERS(type, params), async ({ from }) => {
    if (isClickhouseEnabled) {
      return {
        items: [],
        next: '',
        prev: '',
        last: '',
        hasNext: false,
        hasPrev: false,
        count: 0,
        limit: 100000,
      };
    }
    const {
      userId,
      createdTimestamp,
      riskLevels,
      pageSize,
      tagKey,
      tagValue,
      sort,
      riskLevelLocked,
      isPepHit,
    } = params;

    const queryObj = {
      pageSize,
      afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
      beforeTimestamp: createdTimestamp ? dayjs(createdTimestamp[1]).valueOf() : undefined,
      filterId: userId,
      filterTagKey: tagKey,
      filterTagValue: tagValue,
      filterRiskLevel: riskLevels,
      ...(type === 'business' && {
        filterUserRegistrationStatus: params.userRegistrationStatus,
      }),
      sortField: sort[0]?.[0] ?? 'createdTimestamp',
      sortOrder: sort[0]?.[1] ?? 'descend',
      filterIsPepHit: isPepHit,
      filterRiskLevelLocked: riskLevelLocked,
    };

    const response =
      type === 'business'
        ? await api.getBusinessUsersList({
            start: from || parsedParams.from,
            ...queryObj,
          })
        : type === 'consumer'
        ? await api.getConsumerUsersList({ start: from || parsedParams.from, ...queryObj })
        : await api.getAllUsersList({ start: from || parsedParams.from, ...queryObj });
    return {
      ...response,
      items: response.items as InternalUser[],
    };
  });

  const offsetPaginateQueryResult = usePaginatedQuery<InternalUser>(
    USERS(type, params),
    async (paginationParams) => {
      if (!isClickhouseEnabled) {
        return {
          items: [],
          total: 0,
        };
      }
      const queryObj = {
        ...paginationParams,
        pageSize: params.pageSize,
        page: params.page,
        sortField: params.sort[0]?.[0],
        sortOrder: params.sort[0]?.[1] ?? 'ascend',
        afterTimestamp: params.createdTimestamp ? dayjs(params.createdTimestamp[0]).valueOf() : 0,
        beforeTimestamp: params.createdTimestamp
          ? dayjs(params.createdTimestamp[1]).valueOf()
          : undefined,
        filterId: params.userId,
        filterTagKey: params.tagKey,
        filterTagValue: params.tagValue,
        filterRiskLevel: params.riskLevels,
        filterRiskLevelLocked: params.riskLevelLocked,
        filterIsPepHit: params.isPepHit,
      };
      const response =
        type === 'business'
          ? await api.getBusinessUsersListV2({
              ...queryObj,
              filterUserRegistrationStatus: params.userRegistrationStatus,
            })
          : type === 'consumer'
          ? await api.getConsumerUsersListV2({ ...queryObj, filterIsPepHit: params.isPepHit })
          : await api.getAllUsersListV2({ ...queryObj });
      return {
        total: response.count,
        items: response.items as InternalUser[],
      };
    },
  );
  return (
    <PageWrapperContentContainer>
      <UsersTable
        type={type}
        queryResults={isClickhouseEnabled ? offsetPaginateQueryResult : queryResults}
        params={params}
        handleChangeParams={handleChangeParams}
        fitHeight
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
