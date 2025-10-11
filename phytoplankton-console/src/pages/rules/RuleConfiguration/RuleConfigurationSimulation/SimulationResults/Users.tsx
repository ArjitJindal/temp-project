import { useState, useMemo } from 'react';
import { capitalizeWords, firstLetterUpper } from '@flagright/lib/utils/humanize';
import { startCase } from 'lodash';
import s from './index.module.less';
import { SimulationBeaconHit, SimulationBeaconResultUser } from '@/apis';
import { CommonParams } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import * as Card from '@/components/ui/Card';
import { H4 } from '@/components/ui/Typography';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import Id from '@/components/ui/Id';
import { getUserLink } from '@/utils/api/users';
import Tag from '@/components/library/Tag';
import { useSimulationUserResults } from '@/hooks/api/simulation';
import { RISK_LEVEL } from '@/components/library/Table/standardDataTypes';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface SimulationUsersHitProps {
  taskId: string;
  isSimulationRunning?: boolean;
}

interface TableParams extends CommonParams {
  userId?: string;
  userName?: string;
  hit?: string;
}

export const SimulationUsersHit = (props: SimulationUsersHitProps) => {
  const { taskId, isSimulationRunning = false } = props;
  const settings = useSettings();
  const [params, setParams] = useState<TableParams>({
    ...DEFAULT_PARAMS_STATE,
  });
  const helper = new ColumnHelper<SimulationBeaconResultUser>();
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const userAlias = firstLetterUpper(settings.userAlias);
  const columns = helper.list([
    helper.simple<'userId'>({
      key: 'userId',
      title: `${userAlias} ID`,
      type: {
        render: (userId, { item: entity }) => {
          return (
            <Id
              to={getUserLink({ userId: entity.userId, type: entity.userType })}
              testName="user-id"
            >
              {userId}
            </Id>
          );
        },
        link(value, item) {
          return getUserLink({ userId: item.userId, type: item.userType }) ?? '#';
        },
      },
    }),
    helper.simple<'hit'>({
      key: 'hit',
      title: 'Simulation status',
      type: {
        render: (value: SimulationBeaconHit | undefined) => {
          return (
            <Tag color={value === 'HIT' ? 'red' : 'green'}>
              {startCase(value?.split('_').join(' ').toLowerCase() ?? '')}
            </Tag>
          );
        },
        autoFilterDataType: {
          displayMode: 'list',
          kind: 'select',
          mode: 'SINGLE',
          options: [
            { value: 'HIT', label: 'Hit' },
            { value: 'MISS', label: 'Miss' },
          ],
        },
      },
      filtering: true,
    }),
    ...(isRiskLevelsEnabled
      ? [
          helper.simple<'riskLevel'>({
            key: 'riskLevel',
            title: 'Risk level',
            type: RISK_LEVEL,
          }),
        ]
      : []),
    ...(isRiskScoringEnabled
      ? [
          helper.derived<string>({
            value: (item) => {
              return item.riskScore?.toFixed(2) ?? '-';
            },
            title: 'Risk score',
            type: {
              render: (value) => {
                return <>{value ?? '-'}</>;
              },
            },
          }),
        ]
      : []),
    helper.simple<'userName'>({
      key: 'userName',
      title: `${userAlias} name`,
    }),
    helper.simple<'userType'>({
      title: `${userAlias} type`,
      key: 'userType',
      type: {
        render: (userType) => {
          if (userType) {
            return <>{capitalizeWords(userType)}</>;
          } else {
            return <>{'-'}</>;
          }
        },
      },
    }),
  ]);
  const userResults = useSimulationUserResults(taskId, params);

  // Define extraFilters with useMemo to prevent recreation on every render
  const extraFilters = useMemo(
    () => [
      {
        key: 'userId',
        title: `${firstLetterUpper(settings.userAlias)} ID`,
        showFilterByDefault: true,
        renderer: ({ params, setParams }) => (
          <UserSearchButton
            title={`${firstLetterUpper(settings.userAlias)} ID`}
            userId={params.userId ?? null}
            params={params}
            onConfirm={setParams}
            filterType="id"
          />
        ),
      },
      {
        key: 'userName',
        title: `${firstLetterUpper(settings.userAlias)} name`,
        showFilterByDefault: true,
        renderer: ({ params, setParams }) => (
          <UserSearchButton
            title={`${firstLetterUpper(settings.userAlias)} name`}
            userId={params.userId ?? null}
            params={params}
            onConfirm={setParams}
            filterType="name"
          />
        ),
      },
    ],
    [settings.userAlias],
  );

  // Check if any filters are applied - extract keys from both extraFilters and columns
  const hasFiltersApplied = useMemo(() => {
    // Get filter keys from extraFilters
    const extraFilterKeys = extraFilters.map((filter) => filter.key);

    // Get filter keys from columns with filtering enabled
    const columnFilterKeys = columns
      .filter((column: any) => column.filtering && typeof column.key === 'string')
      .map((column: any) => column.key);

    // Combine all filter keys
    const allFilterKeys = [...extraFilterKeys, ...columnFilterKeys];

    return allFilterKeys.some((key) => {
      const value = params[key as keyof TableParams];
      return (
        value !== undefined &&
        value !== null &&
        (Array.isArray(value) ? value.length > 0 : Boolean(value))
      );
    });
  }, [params, extraFilters, columns]);

  // Determine appropriate empty text based on simulation status and filter state
  const getEmptyText = () => {
    if (hasFiltersApplied && !isSimulationRunning) {
      return 'No data to display';
    }
    return 'Simulated entities will be shown after the simulation has finalized';
  };

  return (
    <Card.Root className={s.card}>
      <Card.Section>
        <H4>{`Simulated ${settings.userAlias}s`}</H4>
        <QueryResultsTable<SimulationBeaconResultUser, TableParams>
          columns={columns}
          queryResults={userResults}
          params={params}
          onChangeParams={setParams}
          rowKey="userId"
          fitHeight
          emptyText={getEmptyText()}
          extraFilters={extraFilters}
        />
      </Card.Section>
    </Card.Root>
  );
};
