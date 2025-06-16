import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import { isEmpty } from 'lodash';
import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { getAllUserColumns } from './all-user-columns';
import { RiskLevelButton } from './RiskLevelFilterButton';
import { UserRegistrationStatusFilterButton } from './UserRegistrationStatusFilterButton';
import { UserSearchParams } from '.';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllUsersTableItem, RiskClassificationScore, RiskLevel } from '@/apis';
import { TableColumn, TableData } from '@/components/library/Table/types';
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
import { QueryResult } from '@/utils/queries/types';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getOr } from '@/utils/asyncResource';
import { USER_STATES } from '@/apis/models-custom/UserState';

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
  userAlias: string,
): ExtraFilterProps<UserSearchParams>[] => {
  const extraFilters: ExtraFilterProps<UserSearchParams>[] = [
    {
      key: 'userId',
      title: `${firstLetterUpper(userAlias)} ID/Name`,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          userId={params.userId ?? null}
          onConfirm={(userId) => {
            setParams((state) => ({
              ...state,
              userId: userId ?? undefined,
            }));
          }}
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
          onConfirm={(parentUserId) => {
            setParams((state) => ({
              ...state,
              parentUserId: parentUserId ?? undefined,
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
      key: 'userState',
      title: 'User state',
      renderer: {
        kind: 'select',
        options: USER_STATES.map((state) => ({ value: state, label: state })),
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
  const riskClassificationValuesMap = getOr(riskClassificationValues, []);

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
    columns.push(...getRiskScoringColumns(riskClassificationValuesMap));
  }

  columns.push(getLastUpdatedColumn());

  return (
    <QueryResultsTable<AllUsersTableItem, UserSearchParams>
      tableId={`users-list/${type}`}
      rowKey={'userId'}
      extraFilters={extraFilters(type, params, settings.userAlias || '')}
      columns={columns}
      queryResults={queryResults}
      params={params}
      onChangeParams={handleChangeParams}
      fitHeight={fitHeight}
      pagination={true}
    />
  );
};
