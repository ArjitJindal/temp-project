import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { getAllUserColumns } from './all-user-columns';
import { RiskLevelButton } from './RiskLevelFilterButton';
import { UserRegistrationStatusFilterButton } from './UserRegistrationStatusFilterButton';
import { UserSearchParams } from '.';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllUsersTableItem, RiskClassificationScore, RiskLevel, TenantSettings } from '@/apis';
import { isSingleRow, TableColumn, TableData } from '@/components/library/Table/types';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  BOOLEAN,
  COUNTRY,
  DATE,
  FLOAT,
  PEP_RANK,
  RISK_LEVEL,
} from '@/components/library/Table/standardDataTypes';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import UserTagSearchButton from '@/pages/transactions/components/UserTagSearchButton';
import { map, QueryResult } from '@/utils/queries/types';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { USER_STATES } from '@/apis/models-custom/UserState';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { USER_CHANGES_PROPOSALS } from '@/utils/queries/keys';
import {
  failed,
  init,
  isFailed,
  isInit,
  isLoading,
  isSuccess,
  loading,
} from '@/utils/asyncResource';
import { AllUserTableItem } from '@/pages/users/users-list/data';
import { humanizeKYCStatus } from '@/components/utils/humanizeKYCStatus';
import { humanizeUserStatus } from '@/components/utils/humanizeUserStatus';

type Props = {
  type: 'all' | 'business' | 'consumer';
  queryResults: QueryResult<TableData<AllUsersTableItem>>;
  params: UserSearchParams;
  handleChangeParams: (params: UserSearchParams) => void;
  fitHeight?: boolean;
};

const extraFilters = (
  list: 'business' | 'consumer' | 'all',
  params: UserSearchParams,
  handleChangeParams: (params: UserSearchParams) => void,
  userAlias: string,
  userStateAlias: TenantSettings['userStateAlias'],
  kycStatusAlias: TenantSettings['kycStatusAlias'],
  isApprovalWorkflowsEnabled: boolean,
): ExtraFilterProps<UserSearchParams>[] => {
  const extraFilters: ExtraFilterProps<UserSearchParams>[] = [
    {
      key: 'userId',
      title: `${firstLetterUpper(userAlias)} ID`,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          title={`${firstLetterUpper(userAlias)} ID`}
          userId={params.userId ?? null}
          onConfirm={setParams}
          params={params}
          userType={list === 'business' ? 'BUSINESS' : list === 'consumer' ? 'CONSUMER' : undefined}
          filterType="id"
        />
      ),
    },
    {
      key: 'userName',
      title: `${firstLetterUpper(userAlias)} name`,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          title={`${firstLetterUpper(userAlias)} name`}
          userId={params.userId ?? null}
          params={params}
          onConfirm={setParams}
          userType={list === 'business' ? 'BUSINESS' : list === 'consumer' ? 'CONSUMER' : undefined}
          filterType="name"
        />
      ),
    },
    {
      key: 'parentUserId',
      title: `Parent ${userAlias} ID/Name`,
      showFilterByDefault: false,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          title={`Parent ${userAlias} ID/Name`}
          userId={params.parentUserId ?? null}
          params={params}
          onConfirm={setParams}
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
      key: 'userState',
      title: `${firstLetterUpper(userAlias)} status`,
      renderer: {
        kind: 'select',
        options: USER_STATES.map((state) => ({
          value: state,
          label: humanizeUserStatus(state, userStateAlias),
        })),
        mode: 'MULTIPLE',
        displayMode: 'list',
      },
    },
    {
      key: 'kycStatus',
      title: 'KYC status',
      renderer: {
        kind: 'select',
        options: KYC_STATUSS.map((status) => ({
          value: status,
          label: humanizeKYCStatus(status, kycStatusAlias),
        })),
        mode: 'MULTIPLE',
        displayMode: 'list',
      },
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

  if (list === 'consumer') {
    extraFilters.push({
      key: 'isPepHit',
      title: 'PEP status',
      renderer: BOOLEAN.autoFilterDataType,
    });

    if (params.isPepHit === 'true') {
      extraFilters.push({
        key: 'pepCountry',
        title: 'PEP Country',
        renderer: COUNTRY.autoFilterDataType,
        showFilterByDefault: false,
      });

      extraFilters.push({
        key: 'pepRank',
        title: 'PEP Rank',
        renderer: PEP_RANK.autoFilterDataType,
        showFilterByDefault: false,
      });
    }
  }

  if (isApprovalWorkflowsEnabled) {
    extraFilters.push({
      kind: 'EXTRA',
      title: 'Pending approval',
      key: 'pendingApproval',
      renderer: BOOLEAN.autoFilterDataType,
    });
  }

  return extraFilters;
};

function getRiskScoringColumns(
  riskClassificationValuesMap: RiskClassificationScore[],
): TableColumn<AllUsersTableItem>[] {
  const helper = new ColumnHelper<AllUsersTableItem>();

  return helper.list([
    helper.derived<RiskLevel>({
      title: 'CRA risk level',
      type: RISK_LEVEL,
      tooltip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
      value: (entity): RiskLevel | undefined => {
        return !isEmpty(entity.manualRiskLevel)
          ? entity.manualRiskLevel
          : getRiskLevelFromScore(riskClassificationValuesMap, entity.drsScore || null);
      },
    }),
    helper.derived({
      title: 'CRA risk score',
      type: FLOAT,
      tooltip: 'Customer risk assessment - accounts for both Base risk and action risk scores.',
      value: (entity) =>
        !isEmpty(entity.manualRiskLevel) && entity.manualRiskLevel != null
          ? getRiskScoreFromLevel(riskClassificationValuesMap, entity.manualRiskLevel)
          : entity.drsScore,
    }),
    helper.simple<'isRiskLevelLocked'>({
      key: 'isRiskLevelLocked',
      title: 'Is locked',
      type: {
        render: (value) => <>{value ? 'Yes' : 'No'}</>,
      },
      tooltip: 'Whether customer risk assessment score is locked',
    }),
    helper.derived({
      title: 'KRS risk level',
      value: (entity) => {
        const score = entity.krsScore;
        return getRiskLevelFromScore(riskClassificationValuesMap, score || null);
      },
      type: RISK_LEVEL,
      tooltip: 'Know your customer - accounts for KYC Risk Level',
    }),
    helper.simple<'krsScore'>({
      key: 'krsScore',
      title: 'KRS risk score',
      type: FLOAT,
      tooltip: 'Know your customer - accounts for KYC Risk Score',
    }),
  ]);
}

export const UsersTable = (props: Props) => {
  const { type, queryResults, params, handleChangeParams, fitHeight = false } = props;
  const settings = useSettings();

  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const riskClassificationValues = useRiskClassificationScores();

  function getLastUpdatedColumn(): TableColumn<AllUsersTableItem> {
    const helper = new ColumnHelper<AllUsersTableItem>();
    return helper.simple<'updatedAt'>({
      key: 'updatedAt',
      title: 'Last updated',
      sorting: true,
      type: DATE,
    });
  }

  const columns: TableColumn<AllUsersTableItem>[] =
    type === 'business'
      ? (getBusinessUserColumns(settings.userAlias) as TableColumn<AllUsersTableItem>[])
      : type === 'consumer'
      ? (getConsumerUserColumns(settings.userAlias) as TableColumn<AllUsersTableItem>[])
      : (getAllUserColumns(settings.userAlias) as TableColumn<AllUsersTableItem>[]);

  if (isRiskScoringEnabled) {
    columns.push(...getRiskScoringColumns(riskClassificationValues));
  }

  columns.push(getLastUpdatedColumn());

  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');

  const api = useApi();
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

  // Merging query results with pending proposals
  const queryResultsWithProposals: QueryResult<TableData<AllUserTableItem>> = useMemo(() => {
    if (!queryResults) {
      return {
        data: init(),
        refetch: () => {},
      };
    }
    if (!isApprovalWorkflowsEnabled) {
      return queryResults;
    }
    if (isFailed(pendingProposalRes)) {
      return {
        data: failed(pendingProposalRes.message),
        refetch: () => {},
      };
    }
    if (isLoading(pendingProposalRes) || isInit(pendingProposalRes)) {
      return {
        data: loading(),
        refetch: () => {},
      };
    }
    const proposals = pendingProposalRes.value;
    if (isApprovalWorkflowsEnabled && !isSuccess(pendingProposalRes)) {
      return {
        data: loading(),
        refetch: () => {},
      };
    }

    return map(queryResults, (data): TableData<AllUserTableItem> => {
      return {
        ...data,
        items: data.items.map((item) => {
          const userProposals = proposals.filter(
            (x) => isSingleRow(item) && x.userId === item.userId,
          );
          return {
            ...item,
            proposals: userProposals.length > 0 ? userProposals : undefined,
          };
        }),
      };
    });
  }, [queryResults, pendingProposalRes, isApprovalWorkflowsEnabled]);

  const filters = extraFilters(
    type,
    params,
    handleChangeParams,
    settings.userAlias || '',
    settings.userStateAlias,
    settings.kycStatusAlias,
    isApprovalWorkflowsEnabled,
  );

  return (
    <QueryResultsTable<AllUserTableItem, UserSearchParams>
      tableId={`users-list/${type}`}
      rowKey={'userId'}
      extraFilters={filters}
      columns={columns}
      queryResults={queryResultsWithProposals}
      params={params}
      onChangeParams={handleChangeParams}
      fitHeight={fitHeight}
      pagination={true}
    />
  );
};
