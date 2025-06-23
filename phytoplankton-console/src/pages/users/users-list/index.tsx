import { useCallback, useEffect } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { useNavigate, useParams } from 'react-router';
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
  UserType,
  KYCStatus,
} from '@/apis';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl, useNavigationParams } from '@/utils/routing';
import { CommonParams } from '@/components/library/Table/types';
import { USERS } from '@/utils/queries/keys';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useSafeLocalStorageState } from '@/utils/hooks';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
} from '@/apis/types/ObjectParamAPI';

type DefaultParams = DefaultApiGetAllUsersListRequest &
  DefaultApiGetConsumerUsersListRequest &
  DefaultApiGetBusinessUsersListRequest;

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
  userType?: UserType;
  kycStatus?: KYCStatus[];
}

const UsersTab = (props: { type: 'business' | 'consumer' | 'all' }) => {
  const type = props.type;
  const api = useApi({ debounce: 500 });

  const [params, setParams] = useNavigationParams<UserSearchParams>({
    queryAdapter: {
      serializer: queryAdapter.serializer,
      deserializer: (raw) => ({
        ...DEFAULT_PARAMS_STATE,
        ...queryAdapter.deserializer(raw),
      }),
    },
    makeUrl: (rawQueryParams) => makeUrl('/users/list/:list/all', { list: type }, rawQueryParams),
    persist: {
      id: `users-list-navigation-params-${type}`,
    },
  });

  const handleChangeParams = useCallback(
    (newParams: UserSearchParams) => {
      setParams(newParams);
    },
    [setParams],
  );

  const offsetPaginateQueryResult = usePaginatedQuery<AllUsersTableItem>(
    USERS(type, params),
    async (paginationParams) => {
      const queryObj: DefaultParams = {
        ...paginationParams,
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
        filterKycStatus: params.kycStatus,
      };

      const response =
        type === 'business'
          ? await api.getBusinessUsersList({
              ...queryObj,
              filterUserRegistrationStatus: params.userRegistrationStatus,
            })
          : type === 'consumer'
          ? await api.getConsumerUsersList({ ...queryObj, filterIsPepHit: params.isPepHit })
          : await api.getAllUsersList({ ...queryObj });

      return {
        total: response.count,
        items: response.items,
      };
    },
  );

  return (
    <PageWrapperContentContainer>
      <UsersTable
        type={type}
        queryResults={offsetPaginateQueryResult}
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
