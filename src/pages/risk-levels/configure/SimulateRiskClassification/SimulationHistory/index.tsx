import { useRef, useState } from 'react';
import { useApi } from '@/api';
import {
  SimulationPostResponse,
  RiskClassificationScore,
  SimulationPulseJob,
  SimulationType,
} from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, DEFAULT_PARAMS_STATE, TableActionType } from '@/components/ui/Table';
import COLORS from '@/components/ui/colors';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { SIMULATION_PULSE_JOB_LIST } from '@/utils/queries/keys';
import { RiskLevel } from '@/utils/risk-levels';
import { useUsers } from '@/utils/user-utils';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';

type SimulationHistoryProps = {
  setResult: (results: SimulationPostResponse) => void;
  setOpen: (open: boolean) => void;
};

const renderRiskLevelData = (
  riskClassifications: Array<RiskClassificationScore>,
  riskLevel: RiskLevel,
) => {
  const requiredRiskScores = riskClassifications?.find(
    (classification) => classification.riskLevel === riskLevel,
  );

  return requiredRiskScores?.lowerBoundRiskScore != null &&
    requiredRiskScores?.upperBoundRiskScore != null ? (
    <span>
      {requiredRiskScores?.lowerBoundRiskScore} to {'<'} {requiredRiskScores?.upperBoundRiskScore}
    </span>
  ) : (
    <span>-</span>
  );
};

export default function SimulationHistory(props: SimulationHistoryProps) {
  const api = useApi();
  const [users, loading] = useUsers({ includeRootUsers: true, includeBlockedUsers: true });
  const { setResult, setOpen } = props;
  const [params, setParams] = useState<AllParams<{ type: SimulationType }>>({
    ...DEFAULT_PARAMS_STATE,
    type: 'PULSE',
    sort: [['createdAt', 'descend']],
  });

  const allSimulationsQueryResult = usePaginatedQuery(
    SIMULATION_PULSE_JOB_LIST(params),
    async () => {
      const simulations = await api.getSimulations({
        type: params.type,
        page: params.page,
        pageSize: params.pageSize,
        sortField: params.sort[0]?.[0],
        sortOrder: params.sort[0]?.[1] ?? 'ascend',
      });

      return {
        items: simulations.data,
        total: simulations.total,
      };
    },
  );
  const actionRef = useRef<TableActionType>(null);

  return (
    <QueryResultsTable<SimulationPulseJob, typeof params>
      actionRef={actionRef}
      queryResults={allSimulationsQueryResult}
      params={params}
      onChangeParams={setParams}
      rowKey="jobId"
      columns={[
        {
          title: 'Simulation ID',
          dataIndex: 'jobId',
          exportData: 'jobId',
          width: 180,
          sorter: true,
          render: (_, item) => (
            <a
              href="#"
              style={{ color: COLORS.brandBlue.base }}
              onClick={() => {
                setResult({
                  jobId: item.jobId,
                  taskIds: item.iterations.map((iteration) => iteration.taskId ?? ''),
                });
                setOpen(true);
              }}
            >
              {item.jobId}
            </a>
          ),
        },
        {
          title: 'Default risk level',
          children: [
            {
              title: 'Very Low',
              dataIndex: 'defaultRiskLevel.veryLow',
              render: (_, item) =>
                renderRiskLevelData(item?.defaultRiskClassifications, 'VERY_LOW'),
              exportData: (item) =>
                renderRiskLevelData(item?.defaultRiskClassifications, 'VERY_LOW'),
            },
            {
              title: 'Low',
              dataIndex: 'defaultRiskLevel.low',
              render: (_, item) => renderRiskLevelData(item?.defaultRiskClassifications, 'LOW'),
              exportData: (item) => renderRiskLevelData(item?.defaultRiskClassifications, 'LOW'),
            },
            {
              title: 'Medium',
              dataIndex: 'defaultRiskLevel.medium',
              render: (_, item) => renderRiskLevelData(item?.defaultRiskClassifications, 'MEDIUM'),
              exportData: (item) => renderRiskLevelData(item?.defaultRiskClassifications, 'MEDIUM'),
            },
            {
              title: 'High',
              dataIndex: 'defaultRiskLevel.high',
              render: (_, item) => renderRiskLevelData(item?.defaultRiskClassifications, 'HIGH'),
              exportData: (item) => renderRiskLevelData(item?.defaultRiskClassifications, 'HIGH'),
            },
            {
              title: 'Very High',
              dataIndex: 'defaultRiskLevel.veryHigh',
              render: (_, item) =>
                renderRiskLevelData(item?.defaultRiskClassifications, 'VERY_HIGH'),
              exportData: (item) =>
                renderRiskLevelData(item?.defaultRiskClassifications, 'VERY_HIGH'),
            },
          ],
        },
        {
          title: 'Created on',
          dataIndex: 'createdAt',
          width: 150,
          sorter: true,
          exportData: (item) => {
            if (!item.createdAt) {
              return '-';
            }
            return dayjs(item.createdAt).format(DEFAULT_DATE_TIME_FORMAT);
          },
          render: (_, item) => {
            if (!item.createdAt) {
              return '-';
            }
            return <span>{dayjs(item.createdAt).format(DEFAULT_DATE_TIME_FORMAT)}</span>;
          },
        },
        {
          title: 'Created by',
          dataIndex: 'createdBy',
          exportData: (item) => {
            const createdBy = item.createdBy;
            if (loading || !createdBy) {
              return '';
            }

            const user = users[createdBy]?.name;

            return <span>{user}</span>;
          },
          render: (_, item) => {
            const createdBy = item.createdBy;
            if (loading || !createdBy) {
              return '';
            }

            const user = users[createdBy]?.name;

            return <span>{user}</span>;
          },
        },
        {
          title: '# Iterations',
          dataIndex: 'iterations_count',
          exportData: (item) => {
            return item.iterations.length;
          },
          render: (_, item) => {
            return <span>{item.iterations.length}</span>;
          },
          sorter: true,
        },
      ]}
      search={false}
      hideFilters={true}
    />
  );
}
