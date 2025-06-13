import { useState } from 'react';
import { capitalizeWords, firstLetterUpper } from '@flagright/lib/utils/humanize';
import { startCase } from 'lodash';
import s from './index.module.less';
import { SimulationBeaconResultUser } from '@/apis';
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
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOB_ITERATION_RESULT } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { RISK_LEVEL } from '@/components/library/Table/standardDataTypes';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface SimulationUsersHitProps {
  taskId: string;
}

interface TableParams extends CommonParams {
  userId?: string;
}

export const SimulationUsersHit = (props: SimulationUsersHitProps) => {
  const { taskId } = props;
  const settings = useSettings();
  const [params, setParams] = useState<TableParams>({
    ...DEFAULT_PARAMS_STATE,
  });
  const helper = new ColumnHelper<SimulationBeaconResultUser>();
  const api = useApi();
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
        render: (value) => {
          return (
            <Tag color={value === 'HIT' ? 'red' : 'green'}>
              {startCase(value?.split('_').join(' ').toLowerCase() ?? '')}
            </Tag>
          );
        },
      },
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
          helper.simple<'riskScore'>({
            key: 'riskScore',
            title: 'Risk score',
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
  const userResults = usePaginatedQuery<SimulationBeaconResultUser>(
    SIMULATION_JOB_ITERATION_RESULT(taskId, {
      ...params,
      filterType: 'BEACON_USER',
    }),
    async (paginationParams) => {
      const response = await api.getSimulationTaskIdResult({
        taskId,
        ...params,
        page: paginationParams.page || params.page,
        pageSize: params.pageSize,
        filterType: 'BEACON_USER',
        filterUserId: params.userId,
      });

      return {
        items: response.items as SimulationBeaconResultUser[],
        total: response.total,
      };
    },
  );

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
          emptyText="Simulated entities will be shown after the simulation has finalized"
          extraFilters={[
            {
              key: 'userId',
              title: `${firstLetterUpper(settings.userAlias)} ID/name`,
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
          ]}
        />
      </Card.Section>
    </Card.Root>
  );
};
