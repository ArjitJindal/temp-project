import { useCallback, useEffect, useState, useMemo } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { useLocation, useNavigate, useParams } from 'react-router';
import { queryAdapter } from './helpers/queryAdapter';
import { UsersTable } from './users-table';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import {
  AllUsersTableItem,
  CountryCode,
  PepRank,
  RiskLevel,
  UserRegistrationStatus,
  UserState,
} from '@/apis';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { CommonParams } from '@/components/library/Table/types';
import { USERS } from '@/utils/queries/keys';
import { useCursorQuery, usePaginatedQuery } from '@/utils/queries/hooks';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { NavigationState } from '@/utils/queries/types';
import { useDeepEqualEffect, useSafeLocalStorageState } from '@/utils/hooks';

export interface UserSearchParams extends CommonParams {
  isPepHit?: 'true' | 'false';
  pepCountry?: CountryCode[];
  pepRank?: PepRank;
  riskLevels?: RiskLevel[];
  userId?: string;
  parentUserId?: string;
  tagKey?: string;
  tagValue?: string;
  createdTimestamp?: string[];
  userRegistrationStatus?: UserRegistrationStatus[];
  riskLevelLocked?: 'true' | 'false';
  countryOfResidence?: CountryCode[];
  countryOfNationality?: CountryCode[];
  userState?: UserState[];
}

const UsersTab = (props: { type: 'business' | 'consumer' | 'all' }) => {
  const type = props.type;
  const api = useApi({ debounce: 500 });
  const navigate = useNavigate();
  const location = useLocation();
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');

  const parsedParams = useMemo(
    () => queryAdapter.deserializer(parseQueryString(location.search)),
    [location.search],
  );

  const [params, setParams] = useState<UserSearchParams>({
    sort: [],
    pageSize: 20,
  });

  const [isReadyToFetch, setIsReadyToFetch] = useState(false);

  const pushParamsToNavigation = useCallback(
    (params: UserSearchParams) => {
      const state: NavigationState = {
        isInitialised: true,
      };
      navigate(makeUrl('/users/list/:list/all', { list: type }, queryAdapter.serializer(params)), {
        replace: true,
        state: state,
      });
    },
    [navigate, type],
  );

  const handleChangeParams = useCallback(
    (newParams: UserSearchParams) => {
      pushParamsToNavigation(newParams);
    },
    [pushParamsToNavigation],
  );

  useDeepEqualEffect(() => {
    if ((location.state as NavigationState)?.isInitialised !== true) {
      return;
    }
    setParams((prevState: UserSearchParams) => ({
      ...prevState,
      ...parsedParams,
    }));
  }, [parsedParams]);

  useEffect(() => {
    if ((location.state as NavigationState)?.isInitialised !== true) {
      // Initialize from URL parameters if they exist, otherwise use defaults
      const defaultParams = {
        ...params,
        ...parsedParams,
      };
      setParams(defaultParams);
      pushParamsToNavigation(defaultParams);
    }
    setIsReadyToFetch(true);
  }, [location.state, parsedParams, pushParamsToNavigation, params]);

  const queryResults = useCursorQuery<AllUsersTableItem>(
    USERS(type, { ...params, isClickhouseEnabled }),
    async ({ from, view: tableView }) => {
      if (isClickhouseEnabled) {
        return {
          from: from || params.from,
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

      const queryObj = {
        view: tableView ?? params.view,
        pageSize: params.pageSize,
        afterTimestamp: params.createdTimestamp ? dayjs(params.createdTimestamp[0]).valueOf() : 0,
        beforeTimestamp: params.createdTimestamp
          ? dayjs(params.createdTimestamp[1]).valueOf()
          : undefined,
        filterId: params.userId,
        filterParentId: params.parentUserId,
        filterTagKey: params.tagKey,
        filterTagValue: params.tagValue,
        filterRiskLevel: params.riskLevels,
        ...(type === 'business' && {
          filterUserRegistrationStatus: params.userRegistrationStatus,
        }),
        sortField: params.sort[0]?.[0] ?? 'createdTimestamp',
        sortOrder: params.sort[0]?.[1] ?? 'ascend',
        filterIsPepHit: params.isPepHit,
        filterPepRank: params.pepRank,
        filterRiskLevelLocked: params.riskLevelLocked,
        filterPepCountry: params.pepCountry,
        filterCountryOfResidence: params.countryOfResidence,
        filterCountryOfNationality: params.countryOfNationality,
        filterUserState: params.userState,
      };

      const queryParam = {
        start: from || params.from,
        ...queryObj,
      };

      const response =
        type === 'business'
          ? await api.getBusinessUsersList(queryParam)
          : type === 'consumer'
          ? await api.getConsumerUsersList(queryParam)
          : await api.getAllUsersList(queryParam);

      return {
        ...response,
        from: from || params.from,
        items: response.items,
      };
    },
    {
      enabled: isReadyToFetch,
    },
  );

  const offsetPaginateQueryResult = usePaginatedQuery<AllUsersTableItem>(
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
        start: paginationParams.from || params.from,
        pageSize: params.pageSize,
        page: paginationParams.page || params.page,
        sortField: params.sort[0]?.[0],
        sortOrder: params.sort[0]?.[1] ?? 'ascend',
        afterTimestamp: params.createdTimestamp ? dayjs(params.createdTimestamp[0]).valueOf() : 0,
        beforeTimestamp: params.createdTimestamp
          ? dayjs(params.createdTimestamp[1]).valueOf()
          : undefined,
        filterId: params.userId,
        filterParentId: params.parentUserId,
        filterTagKey: params.tagKey,
        filterTagValue: params.tagValue,
        filterRiskLevel: params.riskLevels,
        filterRiskLevelLocked: params.riskLevelLocked,
        filterIsPepHit: params.isPepHit,
        filterPepCountry: params.pepCountry,
        filterPepRank: params.pepRank,
        filterCountryOfResidence: params.countryOfResidence,
        filterCountryOfNationality: params.countryOfNationality,
        filterUserState: params.userState,
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
        items: response.items,
      };
    },
    {
      enabled: isReadyToFetch,
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
  const settings = useSettings();
  const navigate = useNavigate();
  const i18n = useI18n();
  const [_, setLocalStorageActiveTab] = useSafeLocalStorageState('user-active-tab', list);
  useEffect(() => {
    setLocalStorageActiveTab(list);
  }, [setLocalStorageActiveTab, list]);
  return (
    <PageWrapper
      title={i18n('menu.users.lists').replace('Users', `${firstLetterUpper(settings.userAlias)}s`)}
    >
      <PageTabs
        activeKey={list}
        onChange={(key) => {
          navigate(makeUrl(`/users/list/:list/all`, { list: key }), { replace: true });
        }}
        items={[
          { title: `All ${settings.userAlias}s`, key: 'all', children: <UsersTab type={list} /> },
          {
            title: `Consumer ${settings.userAlias}s`,
            key: 'consumer',
            children: <UsersTab type={list} />,
          },
          {
            title: `Business ${settings.userAlias}s`,
            key: 'business',
            children: <UsersTab type={list} />,
          },
        ]}
      />
    </PageWrapper>
  );
}
