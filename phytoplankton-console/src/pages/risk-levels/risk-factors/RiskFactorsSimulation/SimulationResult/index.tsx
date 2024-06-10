import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Progress } from 'antd';
import { ParametersTableTabs } from '../ParametersTableTabs';
import s from './styles.module.less';
import {
  ParameterAttributeRiskValues,
  RiskLevel,
  SimulationRiskFactorsIteration,
  SimulationRiskFactorsJob,
  SimulationRiskFactorsStatisticsRiskTypeEnum,
  SimulationRiskLevelsAndRiskFactorsResult,
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
import { capitalizeWords } from '@/utils/humanize';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import Tabs from '@/components/library/Tabs';
import Spinner from '@/components/library/Spinner';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  jobId: string;
}

const SIMULATION_REFETCH_INTERVAL = 5;

export const SimulationResult = (props: Props) => {
  const { jobId } = props;
  const navigate = useNavigate();
  function isAllIterationsCompleted(iterations: SimulationRiskFactorsIteration[]): boolean {
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
      }) as Promise<SimulationRiskFactorsJob>,
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
      return api.postPulseRiskParameters({
        PostPulseRiskParametersBulk: iterations[activeIterationIndex - 1].parameters,
      });
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
            children: <SimulationResultWidgets iteration={iteration} />,
          })),
        ]}
      />

      {iterations[activeIterationIndex - 1]?.latestStatus?.status === 'SUCCESS' ? (
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
  iteration: SimulationRiskFactorsIteration;
}

export type RiskFactorsSettings = {
  [key in Entity]?: {
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  };
};

const SimulationResultWidgets = (props: WidgetProps) => {
  const settings = useSettings();
  const { iteration } = props;
  const { pathname } = useLocation();
  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['userId', 'ascend']],
  });
  const isIterationCompleted = (iteration: SimulationRiskFactorsIteration) => {
    return iteration?.latestStatus?.status === 'SUCCESS';
  };
  const api = useApi();
  const iterationQueryResults = useQuery(
    SIMULATION_JOB_ITERATION_RESULT(iteration?.taskId ?? '', {
      ...params,
      isIterationCompleted: isIterationCompleted(iteration),
    }),
    async () => {
      if (iteration?.taskId) {
        return await api.getSimulationTaskIdResult({
          taskId: iteration.taskId,
          page: params.page,
          pageSize: params.pageSize,
          sortField: params.sort?.[0]?.[0] ?? 'userId',
          sortOrder: params.sort?.[0]?.[1] ?? 'ascend',
        });
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
  ]);
  const getCount = useCallback(
    (
      label: 'Before' | 'After',
      scoreType: SimulationRiskFactorsStatisticsRiskTypeEnum,
      riskLevel: RiskLevel,
    ) => {
      return (
        (iteration?.statistics?.[label === 'Before' ? 'current' : 'simulated'] ?? [])?.find(
          (item) => item?.riskLevel === riskLevel && item.riskType === scoreType,
        )?.count ?? 0
      );
    },
    [iteration],
  );

  const getGraphData = useCallback(
    (graphType: SimulationRiskFactorsStatisticsRiskTypeEnum) => {
      if (!isIterationCompleted(iteration)) {
        return { graphData: [], max: 0 };
      }
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
    [getCount, iteration],
  );

  const { graphData: krsGraphdata, max: maxKRS } = getGraphData('KRS');

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
    return deserializeRiskFactors(iteration.parameters.parameterAttributeRiskValues);
  }, [iteration.parameters.parameterAttributeRiskValues]);

  return isIterationCompleted(iteration) ? (
    <div className={s.root}>
      <Card.Root noBorder>
        <Card.Section>
          <span className={s.title}>{iteration.name}</span>
          <span className={s.description}>{iteration.description}</span>
        </Card.Section>
      </Card.Root>
      <Card.Root noBorder>
        <Card.Section>
          <span className={s.title}>Users distribution based on KRS</span>
          <GroupedColumn data={krsGraphdata} max={Math.ceil(maxKRS + maxKRS * 0.2)} />
        </Card.Section>
      </Card.Root>
      <Card.Root noBorder>
        <Card.Section>
          <span className={s.title}>User's updated KRS risk level</span>
          <QueryResultsTable<SimulationRiskLevelsAndRiskFactorsResult>
            columns={columns}
            queryResults={iterationQueryResults}
            rowKey="userId"
            params={params}
            onChangeParams={setParams}
            hideFilters={true}
            toolsOptions={false}
          />
        </Card.Section>
      </Card.Root>
      <Card.Root noBorder>
        <Card.Section className={s.skipGap}>
          <span className={s.title}>Updated risk factors</span>
          <ParametersTableTabs parameterSettings={riskFactorsSettings} canEditParameters={false} />
        </Card.Section>
      </Card.Root>
    </div>
  ) : (
    <Loading
      progress={iteration.progress * 100}
      message={
        pathname.includes('simulation-result')
          ? 'Running the simulation for a random sample of users & generating results for you.'
          : 'Loading simulation results for you.'
      }
      status={iteration.latestStatus.status}
    />
  );
};

export const Loading = ({ message = '', progress = 0, status }) => {
  const isPending = status === 'PENDING';
  const isFailed = status === 'FAILED';
  const progressValue = Number(progress?.toFixed(2) ?? 0);

  return (
    <div className={s.loadingCard}>
      <div className={s.progressBar}>
        {!isFailed && !isPending ? (
          <>
            <Progress percent={progressValue} status="active" />
            {message && (
              <div className={s.loader}>
                <Spinner size="SMALL" /> {message}
              </div>
            )}
          </>
        ) : (
          <div className={s.failed}>
            {isFailed ? (
              'Failed to load simulation results'
            ) : (
              <>
                <Spinner size="SMALL" /> <span>Initializing simulation...</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
