import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isEmpty } from 'lodash';
import { capitalizeWords, firstLetterUpper, humanizeConstant } from '@flagright/lib/utils/humanize';
import SimulationCustomRiskFactorsTable from '../SimulationCustomRiskFactors/SimulationCustomRiskFactorsTable';
import { drawSimulationGraphs } from './report-utils';
import styles from './styles.module.less';
import { Progress } from '@/components/Simulation/Progress';
import {
  RiskEntityType,
  RiskFactorParameter,
  RiskLevel,
  SimulationRiskLevelsAndRiskFactorsResult,
  SimulationV8RiskFactorsIteration,
  SimulationV8RiskFactorsParameters,
  SimulationV8RiskFactorsStatisticsRiskTypeEnum,
  V8RiskSimulationJob,
} from '@/apis';
import {
  AsyncResource,
  init,
  isLoading,
  isSuccess,
  loading,
  success,
  getOr,
} from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { RISK_LEVELS } from '@/utils/risk-levels';
import GroupedColumn from '@/pages/risk-levels/configure/components/Charts';
import { ParameterSettings } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/types';
import { SIMULATION_JOB_ITERATION_RESULT, SIMULATION_RISK_FACTOR } from '@/utils/queries/keys';
import { useQuery, usePaginatedQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useApi } from '@/api';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';
import { message } from '@/components/library/Message';
import { denseArray, getErrorMessage } from '@/utils/lang';
import Tabs from '@/components/library/Tabs';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { makeUrl } from '@/utils/routing';
import COLORS from '@/components/ui/colors';
import RiskFactorsTable from '@/pages/risk-levels/shared/RiskFactorsTable';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';

interface Props {
  jobId: string;
}

const SIMULATION_REFETCH_INTERVAL = 10;

export const SimulationResult = (props: Props) => {
  const settings = useSettings();
  const { jobId } = props;
  const navigate = useNavigate();
  const [isGeneratingPdf] = useState(false);
  const pendingDownloadRef = useRef<(() => void) | null>(null);
  const [demoMode] = useDemoMode();
  const isDemoMode = getOr(demoMode, false);
  const [showDemoProgress, setShowDemoProgress] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setShowDemoProgress(true);
      const timer = setTimeout(() => setShowDemoProgress(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode]);

  useEffect(() => {
    const downloadPdf = pendingDownloadRef.current;
    if (isGeneratingPdf && downloadPdf) {
      pendingDownloadRef.current = null;
      requestAnimationFrame(downloadPdf);
    }
  }, [isGeneratingPdf]);

  function isAllIterationsCompleted(iterations: SimulationV8RiskFactorsIteration[]): boolean {
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
      }) as Promise<V8RiskSimulationJob>,
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
      return api.postBulkRiskFactors({
        RiskFactorsPostRequest: (
          iterations[activeIterationIndex - 1] as SimulationV8RiskFactorsIteration
        ).parameters.parameters,
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

  const handleReportDownload = useCallback(async () => {
    const hideMessage = message.loading('Downloading report...');

    try {
      const iterationsData = iterations.map((iteration) => ({
        name: iteration.name,
        description: iteration.description,
        statistics: iteration.statistics as {
          current: Array<{ count: number; riskLevel: RiskLevel; riskType: string }>;
          simulated: Array<{ count: number; riskLevel: RiskLevel; riskType: string }>;
        },
      }));

      await DownloadAsPDF({
        fileName: `risk-simulation-result-${jobId}-report.pdf`,
        reportTitle: 'Risk Simulation Result Report',
        onCustomPdfGeneration: (doc) => {
          return drawSimulationGraphs(doc, iterationsData, settings);
        },
      });

      message.success('Report downloaded successfully');
    } catch (err) {
      message.fatal(
        'Unable to complete the download!',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      hideMessage();
    }
  }, [iterations, settings, jobId]);

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
                iteration={iteration}
                activeIterationIndex={index + 1}
                showDemoProgress={showDemoProgress}
              />
            ),
          })),
        ]}
      />

      {iterations[activeIterationIndex - 1]?.progress > 0.1 &&
      (!isDemoMode || !showDemoProgress) ? (
        <div className={styles.footer}>
          <div className={styles.footerButtons}>
            <Confirm
              onConfirm={() => {
                updateParametersMutation.mutate();
              }}
              res={updateResouce}
              title="Are you sure you want to update risk factors?"
              text={`This will update risk scores for all the upcoming ${settings.userAlias}s and can't be undone.`}
            >
              {({ onClick }) => (
                <Button type="PRIMARY" onClick={onClick}>
                  Update risk factors
                </Button>
              )}
            </Confirm>
            <Button onClick={handleReportDownload} type={'TETRIARY'}>
              PDF report
            </Button>
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
  iteration: SimulationV8RiskFactorsIteration;
  activeIterationIndex: number;
  jobId: string;
  showDemoProgress: boolean;
}

export type RiskFactorsSettings = {
  [key in RiskEntityType]?: {
    [key in RiskFactorParameter]?: AsyncResource<ParameterSettings>;
  };
};

type TableSearchParams = CommonParams & {
  'current.krs.riskLevel'?: RiskLevel[];
  'simulated.krs.riskLevel'?: RiskLevel[];
  'current.drs.riskLevel'?: RiskLevel[];
  'simulated.drs.riskLevel'?: RiskLevel[];
  userId?: string;
};

const SimulationResultWidgets = (props: WidgetProps) => {
  const settings = useSettings();
  const { iteration, activeIterationIndex, jobId, showDemoProgress } = props;
  const { pathname } = useLocation();
  const [params, setParams] = useState<TableSearchParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['userId', 'ascend']],
  });
  const [demoMode] = useDemoMode();
  const isDemoMode = getOr(demoMode, false);

  const showResults = iteration.progress > 0.1 && (!isDemoMode || !showDemoProgress);
  const api = useApi();

  const iterationQueryResults = usePaginatedQuery(
    SIMULATION_JOB_ITERATION_RESULT(iteration?.taskId ?? '', {
      ...params,
      progress: iteration.progress,
    }),
    async (paginationParams) => {
      if (iteration?.taskId) {
        const response = await api.getSimulationTaskIdResult({
          taskId: iteration.taskId,
          page: paginationParams.page ?? params.page,
          pageSize: paginationParams.pageSize ?? params.pageSize,
          sortField: params.sort?.[0]?.[0] ?? 'userId',
          sortOrder: params.sort?.[0]?.[1] ?? 'ascend',
          filterCurrentKrsLevel: params['current.krs.riskLevel'],
          filterSimulationKrsLevel: params['simulated.krs.riskLevel'],
          filterCurrentDrsLevel: params['current.drs.riskLevel'],
          filterSimulationDrsLevel: params['simulated.drs.riskLevel'],
          filterUserId: params.userId,
        });

        return {
          items: response.items as SimulationRiskLevelsAndRiskFactorsResult[],
          total: response.total,
        };
      } else {
        return {
          items: [] as SimulationRiskLevelsAndRiskFactorsResult[],
          total: 0,
        };
      }
    },
  );
  const helper = new ColumnHelper<SimulationRiskLevelsAndRiskFactorsResult>();
  const userAlias = firstLetterUpper(settings.userAlias);
  const columns: TableColumn<SimulationRiskLevelsAndRiskFactorsResult>[] = helper.list([
    helper.simple<'userId'>({
      title: `${userAlias} ID`,
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
      exporting: true,
    }),
    helper.simple<'userName'>({
      title: `${userAlias} name`,
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
      exporting: true,
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
      exporting: true,
    }),
    helper.simple<'current.krs.riskScore'>({
      title: 'KRS risk score before',
      key: 'current.krs.riskScore',
      type: {
        render: (riskScore) => {
          if (riskScore) {
            return <>{riskScore.toFixed(2)}</>;
          } else {
            return <>{'-'}</>;
          }
        },
      },
      exporting: true,
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
      exporting: true,
    }),
    helper.simple<'simulated.krs.riskScore'>({
      title: 'KRS risk score after',
      key: 'simulated.krs.riskScore',
      type: {
        render: (riskScore) => {
          if (riskScore) {
            return <>{riskScore.toFixed(2)}</>;
          } else {
            return <>{'-'}</>;
          }
        },
      },
      exporting: true,
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
      exporting: true,
    }),
    helper.simple<'current.drs.riskScore'>({
      title: 'CRA risk score before',
      key: 'current.drs.riskScore',
      type: {
        render: (riskScore) => {
          if (riskScore) {
            return <>{riskScore.toFixed(2)}</>;
          } else {
            return <>{'-'}</>;
          }
        },
      },
      exporting: true,
    }),
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
      exporting: true,
    }),
    helper.simple<'simulated.drs.riskScore'>({
      title: 'CRA risk score after',
      key: 'simulated.drs.riskScore',
      type: {
        render: (riskScore) => {
          if (riskScore) {
            return <>{riskScore.toFixed(2)}</>;
          } else {
            return <>{'-'}</>;
          }
        },
      },
      exporting: true,
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
      exporting: true,
    }),
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
  const { graphData: drsGraphData, max: maxDRS } = getGraphData('DRS');

  const filter: ExtraFilterProps<TableSearchParams>[] = denseArray([
    {
      key: 'userId',
      title: `${userAlias} ID`,
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

  return showResults ? (
    <div className={styles.root}>
      <Card.Root noBorder>
        <Card.Section>
          <span className={styles.title}>{iteration.name}</span>
          {!!iteration.description && (
            <span className={styles.description}>{iteration.description}</span>
          )}
        </Card.Section>
      </Card.Root>
      {iteration.progress < 1 && (
        <Progress
          simulationStartedAt={iteration.createdAt ?? 0}
          width="FULL"
          progress={iteration.progress * 100}
          message={`Running the simulation for a random sample of ${settings.userAlias}s & generating results for you.`}
          status={iteration.latestStatus.status}
          totalEntities={iteration.totalEntities}
        />
      )}

      <div className={styles.graphs}>
        <Card.Root noBorder>
          <Card.Section>
            <span className={styles.title}>{`${userAlias}s distribution based on KRS`}</span>
            <GroupedColumn data={krsGraphdata} max={Math.ceil(maxKRS + maxKRS * 0.2)} />
          </Card.Section>
        </Card.Root>
        <Card.Root noBorder>
          <Card.Section>
            <span className={styles.title}>{`${userAlias}s distribution based on CRA`}</span>
            <GroupedColumn data={drsGraphData} max={Math.ceil(maxDRS + maxDRS * 0.2)} />
          </Card.Section>
        </Card.Root>
        <Card.Root noBorder>
          <Card.Section>
            <span className={styles.title}>Transactions distribution based on TRS</span>
            <GroupedColumn data={arsGraphData} max={Math.ceil(maxARS + maxARS * 0.2)} />
          </Card.Section>
        </Card.Root>
      </div>
      <Card.Root noBorder>
        <Card.Section className={styles.tableContainer}>
          <span className={styles.title}>{`${userAlias}'s updated KRS risk levels`}</span>
          <QueryResultsTable<SimulationRiskLevelsAndRiskFactorsResult, TableSearchParams>
            columns={columns}
            queryResults={iterationQueryResults}
            rowKey="userId"
            params={params}
            onChangeParams={setParams}
            pagination
            toolsOptions={{
              download: true,
              reload: false,
              setting: false,
            }}
            extraFilters={filter}
          />
        </Card.Section>
      </Card.Root>
      <Card.Root noBorder>
        <Card.Section>
          <span className={styles.title}>Updated risk factors</span>
          {(iteration.parameters as SimulationV8RiskFactorsParameters)?.parameters ? (
            <SimulationCustomRiskFactorsTable
              riskFactors={(iteration.parameters as SimulationV8RiskFactorsParameters).parameters}
              canEditRiskFactors={false}
              activeIterationIndex={activeIterationIndex}
              jobId={jobId}
            />
          ) : (
            <RiskFactorsTable
              type="consumer"
              isSimulation={true}
              riskFactors={
                (iteration.parameters as SimulationV8RiskFactorsParameters)?.parameters || []
              }
              canEditRiskFactors={false}
              activeIterationIndex={activeIterationIndex}
              jobId={jobId}
            />
          )}
        </Card.Section>
      </Card.Root>
    </div>
  ) : (
    <div className={styles.loadingCard}>
      <Progress
        simulationStartedAt={iteration.createdAt ?? 0}
        width="HALF"
        progress={iteration.progress * 100}
        message={
          pathname.includes('simulation-result')
            ? `Running the simulation for a random sample of ${settings.userAlias}s & generating results for you.`
            : 'Loading simulation results for you.'
        }
        status={showDemoProgress ? 'IN_PROGRESS' : iteration.latestStatus.status}
        totalEntities={iteration.totalEntities}
      />
    </div>
  );
};
