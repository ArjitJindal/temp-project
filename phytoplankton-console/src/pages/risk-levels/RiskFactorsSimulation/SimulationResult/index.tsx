import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isEmpty } from 'lodash';
import { capitalizeWords, humanizeConstant } from '@flagright/lib/utils/humanize';
import cn from 'clsx';
import { ParametersTableTabs } from '../ParametersTableTabs';
import SimulationCustomRiskFactorsTable from '../SimulationCustomRiskFactors/SimulationCustomRiskFactorsTable';
import s from './styles.module.less';
import {
  ParameterAttributeRiskValues,
  RiskLevel,
  SimulationRiskFactorsIteration,
  SimulationRiskFactorsJob,
  SimulationRiskLevelsAndRiskFactorsResult,
  SimulationV8RiskFactorsIteration,
  SimulationV8RiskFactorsJob,
  SimulationV8RiskFactorsParameters,
  SimulationV8RiskFactorsStatisticsRiskTypeEnum,
} from '@/apis';
import { AsyncResource, init, isLoading, isSuccess, loading, success } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { RISK_LEVELS } from '@/utils/risk-levels';
import GroupedColumn from '@/pages/risk-levels/configure/components/Charts';
import {
  Entity,
  ParameterName,
  ParameterSettings,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { SIMULATION_JOB_ITERATION_RESULT, SIMULATION_RISK_FACTOR } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { makeUrl } from '@/utils/routing';
import COLORS from '@/components/ui/colors';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { denseArray, getErrorMessage } from '@/utils/lang';
import Tabs from '@/components/library/Tabs';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Progress } from '@/components/Simulation/Progress';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';

interface Props {
  jobId: string;
}

const SIMULATION_REFETCH_INTERVAL = 10;

export const SimulationResult = (props: Props) => {
  const { jobId } = props;
  const location = useLocation();
  const isCustomRiskFactors = location.pathname.includes('custom-risk-factors');
  const navigate = useNavigate();
  function isAllIterationsCompleted(
    iterations: SimulationRiskFactorsIteration[] | SimulationV8RiskFactorsIteration[],
  ): boolean {
    return iterations.every(
      (iteration) =>
        iteration.latestStatus.status === 'SUCCESS' || iteration.latestStatus.status === 'FAILED',
    );
  }
  const api = useApi();
  const jobResult = useQuery(
    SIMULATION_RISK_FACTOR(jobId ?? ''),
    () =>
      api.getSimulationTestId({
        jobId: jobId ?? '',
      }) as Promise<SimulationRiskFactorsJob | SimulationV8RiskFactorsJob>,
    {
      refetchInterval: (data) =>
        isAllIterationsCompleted(data?.iterations || [])
          ? false
          : SIMULATION_REFETCH_INTERVAL * 1000,
      enabled: Boolean(jobId),
    },
  );
  const [activeIterationIndex, setActiveIterationIndex] = useState<number>(1);
  const [updateResouce, setUpdateResource] = useState<AsyncResource>(init());
  const iterations = useMemo(() => {
    if (isSuccess(jobResult.data)) {
      return jobResult.data.value.iterations ?? [];
    } else if (isLoading(jobResult.data)) {
      return jobResult.data.lastValue?.iterations ?? [];
    }
    return [];
  }, [jobResult.data]);

  const updateParametersMutation = useMutation<void, unknown, void>(
    async () => {
      setUpdateResource(loading());
      if (isCustomRiskFactors) {
        return api.postBulkRiskFactors({
          RiskFactorsPostRequest: (
            iterations[activeIterationIndex - 1] as SimulationV8RiskFactorsIteration
          ).parameters.parameters,
        });
      } else {
        return api.postPulseRiskParameters({
          PostPulseRiskParametersBulk: (
            iterations[activeIterationIndex - 1] as SimulationRiskFactorsIteration
          ).parameters,
        });
      }
    },
    {
      onSuccess: (data) => {
        setUpdateResource(success(data));
        message.success(`Risk factors updated successfully`);
      },
      onError: (err: any) => {
        message.fatal(`Unable to run simulation - ${getErrorMessage(err)}`, err);
      },
    },
  );
  return (
    <div>
      <Tabs
        type="card"
        activeKey={`${activeIterationIndex}`}
        onChange={(key) => {
          setActiveIterationIndex(parseInt(key));
        }}
        items={[
          ...iterations.map((iteration, index) => ({
            title: `Iteration ${index + 1}`,
            key: `${index + 1}`,
            children: (
              <SimulationResultWidgets
                jobId={jobId}
                isCustomRiskFactors={isCustomRiskFactors}
                iteration={iteration}
                activeIterationIndex={index + 1}
              />
            ),
          })),
        ]}
      />

      {iterations[activeIterationIndex - 1]?.progress > 0.1 ? (
        <div className={s.footer}>
          <div className={s.footerButtons}>
            <Confirm
              onConfirm={() => {
                updateParametersMutation.mutate();
              }}
              res={updateResouce}
              title="Are you sure you want to update risk factors?"
              text="This will update risk scores for all the upcoming users and can't be undone."
            >
              {({ onClick }) => (
                <Button type="PRIMARY" onClick={onClick}>
                  Update risk factors
                </Button>
              )}
            </Confirm>
            <Button
              type="TETRIARY"
              onClick={() => {
                navigate(-1);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <></>
      )}
    </div>
  );
};

interface WidgetProps {
  iteration: SimulationRiskFactorsIteration | SimulationV8RiskFactorsIteration;
  isCustomRiskFactors: boolean;
  activeIterationIndex: number;
  jobId: string;
}

export type RiskFactorsSettings = {
  [key in Entity]?: {
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  };
};

type TableSearchParams = CommonParams & {
  currentKrsLevel?: RiskLevel[];
  simulatedKrsLevel?: RiskLevel[];
  userId?: string;
};

const SimulationResultWidgets = (props: WidgetProps) => {
  const settings = useSettings();
  const { iteration, isCustomRiskFactors, activeIterationIndex, jobId } = props;
  const { pathname } = useLocation();
  const [params, setParams] = useState<TableSearchParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['userId', 'ascend']],
  });
  const showResults = iteration.progress > 0.1;
  const api = useApi();
  const iterationQueryResults = useQuery(
    SIMULATION_JOB_ITERATION_RESULT(iteration?.taskId ?? '', {
      ...params,
      progress: iteration.progress,
    }),
    async () => {
      if (iteration?.taskId) {
        const response = await api.getSimulationTaskIdResult({
          taskId: iteration.taskId,
          page: params.page,
          pageSize: params.pageSize,
          sortField: params.sort?.[0]?.[0] ?? 'userId',
          sortOrder: params.sort?.[0]?.[1] ?? 'ascend',
          filterCurrentKrsLevel: params['current.krs.riskLevel'],
          filterSimulationKrsLevel: params['simulated.krs.riskLevel'],
          filterCurrentDrsLevel: params['current.drs.riskLevel'],
          filterSimulationDrsLevel: params['simulated.drs.riskLevel'],
          filterId: params.userId,
        });
        return {
          items: response.items as SimulationRiskLevelsAndRiskFactorsResult[],
          total: response.total,
        };
      } else {
        return {
          items: [],
          total: 0,
        };
      }
    },
  );
  const helper = new ColumnHelper<SimulationRiskLevelsAndRiskFactorsResult>();
  const columns: TableColumn<SimulationRiskLevelsAndRiskFactorsResult>[] = helper.list([
    helper.simple<'userId'>({
      title: 'User ID',
      key: 'userId',
      defaultWidth: 200,
      type: {
        render: (userId, { item: entity }) => {
          return (
            <Link
              to={makeUrl(`/users/list/${entity?.userType?.toLowerCase()}/${userId}`)}
              target="_blank"
              rel="noreferrer"
              style={{ color: COLORS.brandBlue.base }}
            >
              {userId}
            </Link>
          );
        },
      },
    }),
    helper.simple<'userName'>({
      title: 'User name',
      key: 'userName',
      type: {
        render: (userName, { item: entity }) => {
          return (
            <Link
              to={makeUrl(`/users/list/${entity?.userType?.toLowerCase()}/${entity?.userId}`)}
              target="_blank"
              rel="noreferrer"
              style={{ color: COLORS.brandBlue.base }}
            >
              {userName}
            </Link>
          );
        },
      },
    }),
    helper.simple<'userType'>({
      title: 'User type',
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
    helper.simple<'current.krs.riskLevel'>({
      title: 'KRS risk level before',
      key: 'current.krs.riskLevel',
      type: {
        render: (riskLevel) => {
          if (riskLevel) {
            return <>{getRiskLevelLabel(riskLevel, settings)}</>;
          } else {
            return <>{'-'}</>;
          }
        },
      },
    }),
    helper.simple<'simulated.krs.riskLevel'>({
      title: 'KRS risk level after',
      key: 'simulated.krs.riskLevel',
      type: {
        render: (riskLevel) => {
          if (riskLevel) {
            return <>{getRiskLevelLabel(riskLevel, settings)}</>;
          } else {
            return <>{'-'}</>;
          }
        },
      },
    }),
    ...(isCustomRiskFactors
      ? [
          helper.simple<'current.drs.riskLevel'>({
            title: 'CRA risk level before',
            key: 'current.drs.riskLevel',
            type: {
              render: (riskLevel) => {
                if (riskLevel) {
                  return <>{getRiskLevelLabel(riskLevel, settings)}</>;
                } else {
                  return <>{'-'}</>;
                }
              },
            },
          }),
          helper.simple<'simulated.drs.riskLevel'>({
            title: 'CRA risk level after',
            key: 'simulated.drs.riskLevel',
            type: {
              render: (riskLevel) => {
                if (riskLevel) {
                  return <>{getRiskLevelLabel(riskLevel, settings)}</>;
                } else {
                  return <>{'-'}</>;
                }
              },
            },
          }),
        ]
      : []),
  ]);
  const getCount = useCallback(
    (
      label: 'Before' | 'After',
      scoreType: SimulationV8RiskFactorsStatisticsRiskTypeEnum,
      riskLevel: RiskLevel,
    ) => {
      if (isEmpty(iteration?.statistics?.[label === 'Before' ? 'current' : 'simulated'])) {
        return 0;
      }
      return (
        (iteration?.statistics?.[label === 'Before' ? 'current' : 'simulated'] ?? [])?.find(
          (item) => item?.riskLevel === riskLevel && item.riskType === scoreType,
        )?.count ?? 0
      );
    },
    [iteration],
  );

  const getGraphData = useCallback(
    (graphType: SimulationV8RiskFactorsStatisticsRiskTypeEnum) => {
      let max = 0;
      const graphData: { name: string; label: string; value: number }[] = [];
      RISK_LEVELS.forEach((label) => {
        const beforeCount = getCount('Before', graphType, label) ?? 0;
        const afterCount = getCount('After', graphType, label) ?? 0;

        max = Math.max(max, beforeCount, afterCount);
        graphData.push({
          name: label,
          label: 'Before',
          value: beforeCount,
        });
        graphData.push({
          name: label,
          label: 'After',
          value: afterCount,
        });
      });
      return { graphData, max };
    },
    [getCount],
  );

  const { graphData: krsGraphdata, max: maxKRS } = getGraphData('KRS');
  const { graphData: arsGraphData, max: maxARS } = getGraphData('ARS');
  const { graphData: drsGraphData, max: maxDRS } = isCustomRiskFactors
    ? getGraphData('DRS')
    : { graphData: [], max: 0 };
  const deserializeRiskFactors = (
    parameterAttributeRiskValues: ParameterAttributeRiskValues[],
  ): RiskFactorsSettings => {
    let deserialisedRiskFactors: RiskFactorsSettings = {};
    for (const parameterAttributeRiskValue of parameterAttributeRiskValues) {
      const entity = parameterAttributeRiskValue.riskEntityType;
      const parameter = parameterAttributeRiskValue.parameter;
      const isActive = parameterAttributeRiskValue.isActive;
      const defaultValue = parameterAttributeRiskValue.defaultValue;
      const weight = parameterAttributeRiskValue.weight;
      const values = parameterAttributeRiskValue.riskLevelAssignmentValues;
      const settings: ParameterSettings = {
        isActive,
        defaultValue,
        weight,
        values,
      };
      if (!deserialisedRiskFactors[entity]) {
        deserialisedRiskFactors[entity] = {};
      }
      deserialisedRiskFactors = {
        ...deserialisedRiskFactors,
        [entity]: {
          ...deserialisedRiskFactors[entity],
          [parameter]: success(settings),
        },
      };
    }
    return deserialisedRiskFactors;
  };

  const riskFactorsSettings: RiskFactorsSettings = useMemo(() => {
    if (iteration.type === 'RISK_FACTORS') {
      return deserializeRiskFactors(iteration.parameters.parameterAttributeRiskValues);
    }
    return {};
  }, [iteration.parameters, iteration.type]);

  const filter: ExtraFilterProps<TableSearchParams>[] = denseArray([
    {
      key: 'userId',
      title: 'User ID',
      showFilterByDefault: true,
      renderer: ({ params, setParams }) => (
        <UserSearchButton
          userId={params.userId ? String(params.userId) : null}
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
      title: 'Current KRS level',
      key: 'current.krs.riskLevel',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: RISK_LEVELS.map((x) => ({ value: x, label: humanizeConstant(x) })),
      },
      showFilterByDefault: true,
    },
    {
      title: 'Simulated KRS level',
      key: 'simulated.krs.riskLevel',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: RISK_LEVELS.map((x) => ({ value: x, label: humanizeConstant(x) })),
      },
      showFilterByDefault: true,
    },
  ]);

  if (isCustomRiskFactors) {
    filter.push({
      title: 'Current CRA level',
      key: 'current.drs.riskLevel',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: RISK_LEVELS.map((x) => ({ value: x, label: humanizeConstant(x) })),
      },
      showFilterByDefault: true,
    });

    filter.push({
      title: 'Simulated CRA level',
      key: 'simulated.drs.riskLevel',
      renderer: {
        kind: 'select',
        mode: 'MULTIPLE',
        displayMode: 'list',
        options: RISK_LEVELS.map((x) => ({ value: x, label: humanizeConstant(x) })),
      },
      showFilterByDefault: true,
    });
  }

  return showResults ? (
    <div className={s.root}>
      <Card.Root noBorder>
        <Card.Section>
          <span className={s.title}>{iteration.name}</span>
          {!!iteration.description && (
            <span className={s.description}>{iteration.description}</span>
          )}
        </Card.Section>
      </Card.Root>
      {iteration.progress < 1 && (
        <Progress
          simulationStartedAt={iteration.createdAt ?? 0}
          width="FULL"
          progress={iteration.progress * 100}
          message="Running the simulation for a random sample of users & generating results for you."
          status={iteration.latestStatus.status}
          totalEntities={iteration.totalEntities}
        />
      )}

      <div className={s.graphs}>
        <Card.Root noBorder>
          <Card.Section>
            <span className={s.title}>Users distribution based on KRS</span>
            <GroupedColumn data={krsGraphdata} max={Math.ceil(maxKRS + maxKRS * 0.2)} />
          </Card.Section>
        </Card.Root>
        {isCustomRiskFactors && (
          <Card.Root noBorder>
            <Card.Section>
              <span className={s.title}>Users distribution based on CRA</span>
              <GroupedColumn data={drsGraphData} max={Math.ceil(maxDRS + maxDRS * 0.2)} />
            </Card.Section>
          </Card.Root>
        )}
        <Card.Root noBorder>
          <Card.Section>
            <span className={s.title}>Transactions distribution based on TRS</span>
            <GroupedColumn data={arsGraphData} max={Math.ceil(maxARS + maxARS * 0.2)} />
          </Card.Section>
        </Card.Root>
      </div>
      <Card.Root noBorder>
        <Card.Section>
          <span className={s.title}>
            User's updated {isCustomRiskFactors ? '' : 'KRS'} risk levels
          </span>
          <QueryResultsTable<SimulationRiskLevelsAndRiskFactorsResult>
            columns={columns}
            queryResults={iterationQueryResults}
            rowKey="userId"
            params={params}
            onChangeParams={setParams}
            toolsOptions={false}
            extraFilters={filter}
          />
        </Card.Section>
      </Card.Root>
      <Card.Root noBorder>
        <Card.Section
          className={cn(!isCustomRiskFactors && s.skipGap, isCustomRiskFactors && s.haveGap)}
        >
          <span className={s.title}>Updated risk factors</span>
          {isCustomRiskFactors ? (
            <SimulationCustomRiskFactorsTable
              riskFactors={(iteration.parameters as SimulationV8RiskFactorsParameters).parameters}
              canEditRiskFactors={false}
              activeIterationIndex={activeIterationIndex}
              jobId={jobId}
            />
          ) : (
            <ParametersTableTabs
              parameterSettings={riskFactorsSettings}
              canEditParameters={false}
            />
          )}
        </Card.Section>
      </Card.Root>
    </div>
  ) : (
    <div className={s.loadingCard}>
      <Progress
        simulationStartedAt={iteration.createdAt ?? 0}
        width="HALF"
        progress={iteration.progress * 100}
        message={
          pathname.includes('simulation-result')
            ? 'Running the simulation for a random sample of users & generating results for you.'
            : 'Loading simulation results for you.'
        }
        status={iteration.latestStatus.status}
        totalEntities={iteration.totalEntities}
      />
    </div>
  );
};
