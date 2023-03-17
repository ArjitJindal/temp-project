import { LoadingOutlined } from '@ant-design/icons';
import { ActionType } from '@ant-design/pro-table';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GroupedColumn from '../components/Charts';
import RiskClassificationTable, { parseApiState } from '../RiskClassificationTable';
import s from './styles.module.less';
import { H4, H5, P } from '@/components/ui/Typography';
import Drawer from '@/components/library/Drawer';
import Tabs from '@/components/library/Tabs';
import {
  RiskLevel,
  SimulationPulseIteration,
  SimulationPulseResult,
  SimulationPostResponse,
  SimulationPulseStatisticsRiskTypeEnum,
} from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_PULSE_JOB, SIMULATION_PULSE_JOB_ITERATION_RESULT } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { TableColumn } from '@/components/ui/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import Button from '@/components/library/Button';
import { message } from '@/components/library/Message';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { makeUrl } from '@/utils/routing';
import COLORS from '@/components/ui/colors';
import { capitalizeWords } from '@/utils/tags';
import { isSuccess } from '@/utils/asyncResource';

type Props = {
  onClose: (toClose: boolean) => void;
  isVisible: boolean;
  result: SimulationPostResponse;
};

type IterationProps = {
  iteration: SimulationPulseIteration;
};

const columns: TableColumn<SimulationPulseResult>[] = [
  {
    title: 'User name',
    dataIndex: 'userName',
    exportData: 'userName',
    render: (dom, entity) => {
      return (
        <Link
          to={makeUrl(`/users/list/${entity?.userType?.toLowerCase()}/${entity?.userId}`)}
          target="_blank"
          rel="noreferrer"
          style={{ color: COLORS.brandBlue.base }}
        >
          {entity?.userName}
        </Link>
      );
    },
  },
  {
    title: 'User type',
    dataIndex: 'userType',
    exportData: 'userType',
    render: (dom, entity) => {
      if (entity?.userType) {
        return <>{capitalizeWords(entity?.userType)}</>;
      } else {
        return <>{'-'}</>;
      }
    },
  },
  {
    title: 'KRS risk level',
    children: [
      {
        title: 'Before',
        dataIndex: 'current.krs.riskLevel',
        exportData: 'current.krs.riskLevel',
        render: (dom, entity) => {
          if (entity?.current?.krs?.riskLevel) {
            return <>{capitalizeWords(entity?.current?.krs?.riskLevel?.replace(/_/g, ' '))}</>;
          } else {
            return <>{'-'}</>;
          }
        },
        sorter: true,
      },
      {
        title: 'After',
        dataIndex: 'simulated.krs.riskLevel',
        exportData: 'simulated.krs.riskLevel',
        render: (dom, entity) => {
          if (entity?.simulated?.krs?.riskLevel) {
            return <>{capitalizeWords(entity?.simulated?.krs?.riskLevel?.replace(/_/g, ' '))}</>;
          } else {
            return <>{'-'}</>;
          }
        },
        sorter: true,
      },
    ],
  },
  {
    title: 'CRA risk level',
    children: [
      {
        title: 'Before',
        dataIndex: 'current.drs.riskLevel',
        exportData: 'current.drs.riskLevel',
        render: (dom, entity) => {
          if (entity?.current?.drs?.riskLevel) {
            return <>{capitalizeWords(entity?.current?.drs?.riskLevel?.replace(/_/g, ' '))}</>;
          } else {
            return <>{'-'}</>;
          }
        },
        sorter: true,
      },
      {
        title: 'After',
        dataIndex: 'simulated.drs.riskLevel',
        exportData: 'simulated.drs.riskLevel',
        render: (dom, entity) => {
          if (entity?.simulated?.drs?.riskLevel) {
            return <>{capitalizeWords(entity?.simulated?.drs?.riskLevel?.replace(/_/g, ' '))}</>;
          } else {
            return <>{'-'}</>;
          }
        },
        sorter: true,
      },
    ],
  },
];

const IterationComponent = (props: IterationProps) => {
  const { iteration } = props;
  const actionRef = useRef<ActionType>(null);
  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['userId', 'ascend']],
  });

  const getCount = (
    label: 'Before' | 'After',
    scoreType: SimulationPulseStatisticsRiskTypeEnum,
    riskLevel: RiskLevel,
  ) =>
    iteration?.statistics?.[label === 'Before' ? 'current' : 'simulated']?.find(
      (item) => item?.riskLevel === riskLevel && item.riskType === scoreType,
    )?.count;

  const api = useApi();
  const iterationQueryResults = useQuery(
    SIMULATION_PULSE_JOB_ITERATION_RESULT(iteration?.taskId ?? '', params),
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

  const getGraphData = (graphType: 'DRS' | 'ARS') => {
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
  };

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
          actionRef={actionRef}
          search={false}
          form={{
            labelWrap: true,
          }}
          scroll={{ x: 300 }}
          rowKey="userId"
          params={params}
          onChangeParams={setParams}
          hideFilters={true}
          headerSubtitle={'User risk score level'}
          disableInternalPadding
          paginationBorder
        />
      </div>
      {iteration?.parameters?.classificationValues && (
        <div style={{ marginTop: 16 }}>
          <RiskClassificationTable
            isDisabled={true}
            state={parseApiState(iteration.parameters.classificationValues)}
            headerSubtitle={'Risk levels'}
            disableInternalPadding
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
  const jobIdQueryResults = useQuery(SIMULATION_PULSE_JOB(result.jobId), () =>
    api.getSimulationTestId({
      jobId: result.jobId,
    }),
  );

  const [activeTab, setActiveTab] = useState<string>(result.taskIds[0]);
  const [buttonLoading, setButtonLoading] = useState<boolean>(false);
  const [buttonDisabled, setButtonDisabled] = useState<boolean>(false);

  useEffect(() => {
    setActiveTab(result.taskIds[0]);
  }, [result.taskIds]);

  const interval = useRef<NodeJS.Timeout | null>(null);

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

  const updateRiskLevels = async () => {
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
            message.success('Risk levels updated successfully');
          }
        } catch (_) {
          message.error('Failed to update risk levels');
        }
      }
    }
    setButtonLoading(false);
  };

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

            return iterations.find((item) => item.taskId === activeTab)?.latestStatus?.status ===
              'SUCCESS' ? (
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
