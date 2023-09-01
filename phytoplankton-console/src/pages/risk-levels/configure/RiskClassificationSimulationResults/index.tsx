import { LoadingOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import GroupedColumn from '../components/Charts';
import RiskClassificationTable, { parseApiState } from '../RiskClassificationTable';
import s from './styles.module.less';
import { H4, H5, P } from '@/components/ui/Typography';
import Drawer from '@/components/library/Drawer';
import Tabs from '@/components/library/Tabs';
import {
  RiskLevel,
  SimulationPostResponse,
  SimulationPulseIteration,
  SimulationPulseJob,
  SimulationPulseResult,
  SimulationPulseStatisticsRiskTypeEnum,
} from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import {
  RISK_CLASSIFICATION_VALUES,
  SIMULATION_JOB,
  SIMULATION_JOB_ITERATION_RESULT,
} from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import Button from '@/components/library/Button';
import { message } from '@/components/library/Message';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { makeUrl } from '@/utils/routing';
import COLORS from '@/components/ui/colors';
import { capitalizeWords } from '@/utils/tags';
import { isSuccess } from '@/utils/asyncResource';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { humanizeConstant } from '@/utils/humanize';

type Props = {
  onClose: (toClose: boolean) => void;
  isVisible: boolean;
  result: SimulationPostResponse;
};

type IterationProps = {
  iteration: SimulationPulseIteration;
};

const helper = new ColumnHelper<SimulationPulseResult>();
const columns: TableColumn<SimulationPulseResult>[] = helper.list([
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
  helper.group({
    title: 'KRS risk level',
    children: helper.list([
      helper.simple<'current.krs.riskLevel'>({
        title: 'Before',
        key: 'current.krs.riskLevel',
        type: {
          render: (riskLevel) => {
            if (riskLevel) {
              return <>{humanizeConstant(riskLevel)}</>;
            } else {
              return <>{'-'}</>;
            }
          },
        },
        sorting: true,
      }),
      helper.simple<'simulated.krs.riskLevel'>({
        title: 'After',
        key: 'simulated.krs.riskLevel',
        type: {
          render: (riskLevel) => {
            if (riskLevel) {
              return <>{humanizeConstant(riskLevel)}</>;
            } else {
              return <>{'-'}</>;
            }
          },
        },
        sorting: true,
      }),
    ]),
  }),
  helper.group({
    title: 'CRA risk level',
    children: [
      helper.simple<'current.drs.riskLevel'>({
        title: 'Before',
        key: 'current.drs.riskLevel',
        type: {
          render: (riskLevel) => {
            if (riskLevel) {
              return <>{humanizeConstant(riskLevel)}</>;
            } else {
              return <>{'-'}</>;
            }
          },
        },
        sorting: true,
      }),
      helper.simple<'simulated.drs.riskLevel'>({
        title: 'After',
        key: 'simulated.drs.riskLevel',
        type: {
          render: (riskLevel) => {
            if (riskLevel) {
              return <>{humanizeConstant(riskLevel)}</>;
            } else {
              return <>{'-'}</>;
            }
          },
        },
        sorting: true,
      }),
    ],
  }),
]);

const IterationComponent = (props: IterationProps) => {
  const { iteration } = props;
  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['userId', 'ascend']],
  });

  const getCount = useCallback(
    (
      label: 'Before' | 'After',
      scoreType: SimulationPulseStatisticsRiskTypeEnum,
      riskLevel: RiskLevel,
    ) => {
      return (
        iteration?.statistics?.[label === 'Before' ? 'current' : 'simulated']?.find(
          (item) => item?.riskLevel === riskLevel && item.riskType === scoreType,
        )?.count ?? 0
      );
    },
    [iteration],
  );

  const api = useApi();
  const iterationQueryResults = useQuery(
    SIMULATION_JOB_ITERATION_RESULT(iteration?.taskId ?? '', params),
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

  const getGraphData = useCallback(
    (graphType: 'DRS' | 'ARS') => {
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

  const { graphData: craGraphData, max: maxCRA } = getGraphData('DRS');
  const { graphData: trsGraphData, max: maxTRS } = getGraphData('ARS');

  return (
    <div className={s.tabContent}>
      <H4>{iteration?.name}</H4>
      <P style={{ color: 'rgba(0, 0, 0, 0.85)' }}>{iteration?.description}</P>
      <div className={s.graphsParentContainer}>
        <div className={s.graphsContainer}>
          <H5 style={{ marginBottom: '1.5rem' }}>Users distribution based on CRA</H5>
          <GroupedColumn data={craGraphData} max={Math.ceil(maxCRA + maxCRA * 0.2)} />{' '}
          {/*Hack so that labels doesn't hide */}
        </div>
        <div className={s.graphsContainer}>
          <H5 style={{ marginBottom: '1.5rem' }}>Transactions distribution based on TRS</H5>
          <GroupedColumn data={trsGraphData} max={Math.ceil(maxTRS + maxTRS * 0.2)} />
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <QueryResultsTable<SimulationPulseResult>
          columns={columns}
          queryResults={iterationQueryResults}
          rowKey="userId"
          params={params}
          onChangeParams={setParams}
          hideFilters={true}
        />
      </div>
      {iteration?.parameters?.classificationValues && (
        <div style={{ marginTop: 16 }}>
          <H4>Risk levels</H4>
          <RiskClassificationTable
            isDisabled={true}
            state={parseApiState(iteration.parameters.classificationValues)}
          />
        </div>
      )}
    </div>
  );
};

const LoadingWidget = () => {
  return (
    <div className={s.tabContentLoading}>
      <div className={s.loadingSpinner}>
        <LoadingOutlined className={s.spinner} spin />
        <P>Running the simulation for a subset of transactions & generating results for you</P>
      </div>
    </div>
  );
};

export default function RiskClassificationSimulationResults(props: Props) {
  const { onClose, isVisible, result } = props;
  const api = useApi();
  const jobIdQueryResults = useQuery(
    SIMULATION_JOB(result.jobId),
    () =>
      api.getSimulationTestId({
        jobId: result.jobId,
      }) as Promise<SimulationPulseJob>,
  );

  const [activeTab, setActiveTab] = useState<string>(result.taskIds[0]);
  const [buttonLoading, setButtonLoading] = useState<boolean>(false);
  const [buttonDisabled, setButtonDisabled] = useState<boolean>(false);

  useEffect(() => {
    setActiveTab(result.taskIds[0]);
  }, [result.taskIds]);

  const interval = useRef<NodeJS.Timeout | null>(null);

  // TODO: Refactor this
  useEffect(() => {
    if (jobIdQueryResults.data.kind === 'SUCCESS') {
      const status = jobIdQueryResults.data.value.iterations.find(
        (item) => item.taskId === activeTab,
      )?.latestStatus?.status;
      if (status === 'SUCCESS' || status === 'FAILED') {
        if (interval.current) {
          clearInterval(interval.current);
        }
      } else {
        interval.current = setInterval(() => {
          jobIdQueryResults.refetch();
        }, 10000);
      }
    } else {
      if (interval.current) {
        clearInterval(interval.current);
      }
    }
    return () => {
      if (interval.current) {
        clearInterval(interval.current);
      }
    };
  }, [activeTab, jobIdQueryResults]);

  const queryClient = useQueryClient();

  const updateRiskLevels = useCallback(async () => {
    setButtonLoading(true);
    if (jobIdQueryResults.data.kind === 'SUCCESS') {
      const data = jobIdQueryResults.data.value;
      const { iterations } = data;
      const iteration = iterations.find((item) => item.taskId === activeTab);

      if (iteration) {
        try {
          const classificationValues = iteration.parameters.classificationValues;
          if (classificationValues) {
            await api.postPulseRiskClassification({
              RiskClassificationScore: classificationValues,
            });
            queryClient.invalidateQueries(RISK_CLASSIFICATION_VALUES());
            message.success('Risk levels updated successfully');
          }
        } catch (_) {
          message.error('Failed to update risk levels');
        }
      }
    }
    setButtonLoading(false);
  }, [activeTab, jobIdQueryResults, queryClient, api]);

  useEffect(() => {
    if (isSuccess(jobIdQueryResults.data)) {
      const status = jobIdQueryResults.data.value.iterations.find(
        (item) => item.taskId === activeTab,
      )?.latestStatus?.status;
      if (status === 'SUCCESS') {
        setButtonDisabled(false);
      } else {
        setButtonDisabled(true);
      }
    }
  }, [jobIdQueryResults, activeTab]);

  return (
    <Drawer
      title="Simulation results"
      description="Run a simulation using different risk levels to see how the rule performs on the existing transactions to make informed decisions."
      isVisible={isVisible}
      onChangeVisibility={onClose}
      footer={
        <div className={s.drawerFooter}>
          <Button
            type="SECONDARY"
            onClick={updateRiskLevels}
            isLoading={buttonLoading}
            isDisabled={buttonDisabled}
            style={{ marginRight: '1rem' }}
          >
            Update risk levels
          </Button>
          <Button
            onClick={() => onClose(false)}
            type="PRIMARY"
            isLoading={buttonLoading}
            isDisabled={buttonDisabled}
          >
            Done
          </Button>
        </div>
      }
      drawerMaxWidth={'1000px'}
    >
      <div className={s.root}>
        <AsyncResourceRenderer
          resource={jobIdQueryResults.data}
          renderLoading={() => <LoadingWidget />}
        >
          {(data) => {
            const { iterations } = data;

            const items = iterations.map((iteration) => ({
              isClosable: false,
              isDisabled: false,
              key: iteration.taskId ?? '',
              children:
                iteration.latestStatus.status !== 'SUCCESS' ? (
                  <LoadingWidget />
                ) : (
                  <>{iteration.taskId && <IterationComponent iteration={iteration} />}</>
                ),
              tab: iteration.name,
            }));

            return (iterations as SimulationPulseIteration[]).find(
              (item) => item.taskId === activeTab,
            )?.latestStatus?.status === 'SUCCESS' ? (
              <Tabs
                activeKey={activeTab}
                items={items}
                type="card"
                tabHeight={'100%'}
                onChange={(key) => {
                  setActiveTab(key);
                }}
              />
            ) : (
              <LoadingWidget />
            );
          }}
        </AsyncResourceRenderer>
      </div>
    </Drawer>
  );
}
