import { useCallback, useEffect } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { useNavigate, useParams } from 'react-router';
import { queryAdapter } from './helpers/queryAdapter';
import { UsersTable } from './users-table';
import {
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
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useSafeLocalStorageState } from '@/utils/hooks';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useUsersList } from '@/hooks/api/users';

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

  const offsetPaginateQueryResult = useUsersList(type, params);

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

/* Helpers removed: pending proposals hook centralized in hooks/api/workflows */
