import { getBusinessUserColumns } from './business-user-columns';
import { getConsumerUserColumns } from './consumer-users-columns';
import { getAllUserColumns } from './all-user-columns';
import { RiskLevelButton } from './RiskLevelFilterButton';
import { UserRegistrationStatusFilterButton } from './UserRegistrationStatusFilterButton';
import { UserSearchParams } from '.';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { InternalUser, RiskLevel } from '@/apis';
import { TableColumn, TableData } from '@/components/library/Table/types';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { BOOLEAN, DATE, FLOAT, RISK_LEVEL } from '@/components/library/Table/standardDataTypes';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import UserTagSearchButton from '@/pages/transactions/components/UserTagSearchButton';
import { QueryResult } from '@/utils/queries/types';

type Props = {
  type: 'all' | 'business' | 'consumer';
  queryResults: QueryResult<TableData<InternalUser>>;
  params: UserSearchParams;
  handleChangeParams: (params: UserSearchParams) => void;
  fitHeight?: boolean;
};

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

export const UsersTable = (props: Props) => {
  const { type, queryResults, params, handleChangeParams, fitHeight = false } = props;

  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  function getLastUpdatedColumn(): TableColumn<InternalUser> {
    const helper = new ColumnHelper<InternalUser>();
    return helper.simple<'updatedAt'>({
      key: 'updatedAt',
      title: 'Last updated',
      sorting: true,
      type: DATE,
    });
  }

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

  return (
    <QueryResultsTable<InternalUser, UserSearchParams>
      tableId={`users-list/${type}`}
      rowKey={'userId'}
      extraFilters={extraFilters(type)}
      columns={columns}
      queryResults={queryResults}
      params={params}
      onChangeParams={handleChangeParams}
      fitHeight={fitHeight}
      pagination={true}
    />
  );
};
