import { useCallback, useEffect, useMemo } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { useNavigate, useParams } from 'react-router';
import { queryAdapter } from './helpers/queryAdapter';
import { UsersTable } from './users-table';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import {
  AllUsersTableItem,
  CountryCode,
  KYCStatus,
  PepRank,
  RiskLevel,
  UserRegistrationStatus,
  UserState,
  UserType,
} from '@/apis';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import '../../../components/ui/colors';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl, useNavigationParams } from '@/utils/routing';
import { CommonParams } from '@/components/library/Table/types';
import { USER_CHANGES_PROPOSALS, USERS } from '@/utils/queries/keys';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useSafeLocalStorageState } from '@/utils/hooks';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  DefaultApiGetAllUsersListRequest,
  DefaultApiGetBusinessUsersListRequest,
  DefaultApiGetConsumerUsersListRequest,
} from '@/apis/types/ObjectParamAPI';
import { AsyncResource, getOr, map, success } from '@/utils/asyncResource';

type DefaultParams = DefaultApiGetAllUsersListRequest &
  DefaultApiGetConsumerUsersListRequest &
  DefaultApiGetBusinessUsersListRequest;

export interface UserSearchParams extends CommonParams {
  isPepHit?: 'true' | 'false';
  pepCountry?: CountryCode[];
  pepRank?: PepRank;
  riskLevels?: RiskLevel[];
  userId?: string;
  userName?: string;
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
  pendingApproval?: 'true' | 'false';
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
    makeUrl: (rawQueryParams) => makeUrl('/users/list/:list', { list: type }, rawQueryParams),
    persist: {
      id: `users-list-navigation-params-${type}`,
    },
  });

  const handleChangeParams = useCallback(
    (newParams: UserSearchParams) => {
      if (newParams.pendingApproval === 'false') {
        newParams.pendingApproval = undefined;
      }
      setParams(newParams);
    },
    [setParams],
  );

  const pendingProposalsUserIdsRes = usePendingProposalsUserIds(params);

  const offsetPaginateQueryResult = usePaginatedQuery<AllUsersTableItem>(
    USERS(type, { ...params, pendingProposalsUserIds: pendingProposalsUserIdsRes }),
    async (paginationParams) => {
      const pendingProposalsUserIds = getOr(pendingProposalsUserIdsRes, undefined);
      if (
        params.pendingApproval === 'true' &&
        pendingProposalsUserIds != null &&
        pendingProposalsUserIds.length === 0
      ) {
        return {
          items: [],
          total: 0,
        };
      }

      const filterUserIds = pendingProposalsUserIds;

      const queryObj: DefaultParams = {
        pageSize: params.pageSize,
        page: params.page,
        sortField: params.sort[0]?.[0],
        sortOrder: params.sort[0]?.[1] ?? 'ascend',
        afterTimestamp: params.createdTimestamp ? dayjs(params.createdTimestamp[0]).valueOf() : 0,
        beforeTimestamp: params.createdTimestamp
          ? dayjs(params.createdTimestamp[1]).valueOf()
          : undefined,
        filterId: filterUserIds == null ? params.userId : undefined,
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
        filterName: params.userName,
        filterIds: filterUserIds,
        ...paginationParams,
      };

      const response =
        type === 'business'
          ? await api.getBusinessUsersList({
              ...queryObj,
              filterUserRegistrationStatus: params.userRegistrationStatus,
              responseType: 'data',
            })
          : type === 'consumer'
          ? await api.getConsumerUsersList({
              ...queryObj,
              filterIsPepHit: params.isPepHit,
              responseType: 'data',
            })
          : await api.getAllUsersList({ ...queryObj, responseType: 'data' });

      const countResponse =
        type === 'business'
          ? await api.getBusinessUsersList({
              ...queryObj,
              filterUserRegistrationStatus: params.userRegistrationStatus,
              responseType: 'count',
            })
          : type === 'consumer'
          ? await api.getConsumerUsersList({
              ...queryObj,
              filterIsPepHit: params.isPepHit,
              responseType: 'count',
            })
          : await api.getAllUsersList({ ...queryObj, responseType: 'count' });

      return {
        total: countResponse.count,
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
          navigate(makeUrl(`/users/list/:list`, { list: key }), { replace: true });
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

/*
  Helpers
 */
function usePendingProposalsUserIds(params: UserSearchParams): AsyncResource<string[] | undefined> {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  const { data: pendingProposalRes } = useQuery(
    USER_CHANGES_PROPOSALS(),
    async () => {
      const proposals = await api.getAllUserApprovalProposals();
      return proposals;
    },
    {
      enabled: isApprovalWorkflowsEnabled,
    },
  );
  return useMemo(() => {
    if (isApprovalWorkflowsEnabled && params.pendingApproval === 'true') {
      return map(pendingProposalRes, (approvals) => approvals.map((x) => x.userId));
    }
    return success(undefined);
  }, [pendingProposalRes, params.pendingApproval, isApprovalWorkflowsEnabled]);
}
