import { useContext, useMemo, useRef, useState } from 'react';
import { useApi } from '@/api';
import { RiskClassificationScore, SimulationPostResponse, SimulationRiskLevelsJob } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams, TableRefType } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import COLORS from '@/components/ui/colors';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOBS } from '@/utils/queries/keys';
import { RISK_LEVEL_LABELS, RISK_LEVELS } from '@/utils/risk-levels';
import { useUsers } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE, NUMBER } from '@/components/library/Table/standardDataTypes';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import { DefaultApiGetSimulationsRequest } from '@/apis/types/ObjectParamAPI';
import { SuperAdminModeContext } from '@/components/AppWrapper/Providers/SuperAdminModeProvider';

type SimulationHistoryProps = {
  setResult: (results: SimulationPostResponse) => void;
  setOpen: (open: boolean) => void;
};

const renderRiskLevelData = (requiredRiskScores: RiskClassificationScore) => {
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
  const [params, setParams] = useState<AllParams<DefaultApiGetSimulationsRequest>>({
    ...DEFAULT_PARAMS_STATE,
    page: 1,
    type: 'PULSE',
    sort: [['createdAt', 'descend']],
  });
  const context = useContext(SuperAdminModeContext);
  const finalParams = useMemo(
    () => ({ ...params, includeInternal: context?.isSuperAdminMode }),
    [context?.isSuperAdminMode, params],
  );
  const allSimulationsQueryResult = usePaginatedQuery(
    SIMULATION_JOBS(finalParams),
    async (paginationParams) => {
      const simulations = await api.getSimulations({
        type: finalParams.type,
        page: finalParams.page ?? 1,
        pageSize: finalParams.pageSize,
        ...paginationParams,
        sortField: finalParams.sort[0]?.[0],
        sortOrder: finalParams.sort[0]?.[1] ?? 'ascend',
        includeInternal: finalParams?.includeInternal,
      });

      return {
        items: simulations.data as SimulationRiskLevelsJob[],
        total: simulations.total,
      };
    },
  );
  const actionRef = useRef<TableRefType>(null);

  const helper = new ColumnHelper<SimulationRiskLevelsJob>();
  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<SimulationRiskLevelsJob, typeof params>
        rowKey="jobId"
        innerRef={actionRef}
        queryResults={allSimulationsQueryResult}
        params={params}
        onChangeParams={setParams}
        columns={helper.list([
          helper.simple<'jobId'>({
            title: 'Simulation ID',
            key: 'jobId',
            sorting: true,
            type: {
              render: (jobId, { item }) =>
                jobId ? (
                  <a
                    href="#"
                    style={{ color: COLORS.brandBlue.base }}
                    onClick={() => {
                      setResult({
                        jobId: jobId,
                        taskIds: item.iterations.map((iteration) => iteration.taskId ?? ''),
                      });
                      setOpen(true);
                    }}
                  >
                    {jobId}
                  </a>
                ) : (
                  <></>
                ),
            },
          }),
          helper.group({
            title: 'Default risk level',
            children: helper.list(
              RISK_LEVELS.map((riskLevel) =>
                helper.derived<RiskClassificationScore>({
                  title: RISK_LEVEL_LABELS[riskLevel],
                  // dataIndex: 'defaultRiskLevel.veryLow',
                  value: (item): RiskClassificationScore | undefined => {
                    return item?.defaultRiskClassifications?.find((x) => x.riskLevel === riskLevel);
                  },
                  type: {
                    render: (riskScores) => (riskScores ? renderRiskLevelData(riskScores) : <></>),
                  },
                }),
              ),
            ),
          }),
          helper.simple<'createdAt'>({
            title: 'Created at',
            key: 'createdAt',
            // dataIndex: 'createdAt',
            sorting: true,
            type: DATE,
          }),
          helper.simple<'createdBy'>({
            title: 'Created by',
            key: 'createdBy',
            type: {
              render: (createdBy) => {
                if (loading || !createdBy) {
                  return <></>;
                }

                const user = users[createdBy]?.name;

                return <span>{user}</span>;
              },
              stringify: (createdBy) => {
                if (loading || !createdBy) {
                  return '';
                }

                return users[createdBy]?.name;
              },
            },
          }),
          helper.derived<number>({
            title: '# Iterations',
            value: (item) => item.iterations.length,
            type: NUMBER,
            sorting: true,
          }),
        ])}
        hideFilters={true}
      />
    </PageWrapperContentContainer>
  );
}
