import { useContext, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useApi } from '@/api';
import { SimulationRiskFactorsJob, SimulationV8RiskFactorsJob } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams, TableRefType } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOBS } from '@/utils/queries/keys';
import { useUsers } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE, NUMBER, SIMULATION_STATUS } from '@/components/library/Table/standardDataTypes';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import { DefaultApiGetSimulationsRequest } from '@/apis/types/ObjectParamAPI';
import { SuperAdminModeContext } from '@/components/AppWrapper/Providers/SuperAdminModeProvider';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';

export type SimulationJob = SimulationRiskFactorsJob | SimulationV8RiskFactorsJob;
export function SimulationHistory() {
  const api = useApi();
  const location = useLocation();
  const type = location.pathname.includes('custom-risk-factors')
    ? 'RISK_FACTORS_V8'
    : 'RISK_FACTORS';
  const jobUrl = type === 'RISK_FACTORS_V8' ? 'custom-risk-factors' : 'risk-factors';
  const [users, loading] = useUsers({ includeRootUsers: true, includeBlockedUsers: true });
  const [params, setParams] = useState<AllParams<DefaultApiGetSimulationsRequest>>({
    ...DEFAULT_PARAMS_STATE,
    page: 1,
    type: type,
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
        items: simulations.data as SimulationJob[],
        total: simulations.total,
      };
    },
  );
  const actionRef = useRef<TableRefType>(null);
  const helper = new ColumnHelper<SimulationJob>();
  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<SimulationJob, typeof params>
        rowKey="jobId"
        innerRef={actionRef}
        queryResults={allSimulationsQueryResult}
        params={params}
        onChangeParams={setParams}
        paginationBorder
        columns={helper.list([
          helper.simple<'jobId'>({
            title: 'Simulation ID',
            key: 'jobId',
            sorting: true,
            defaultWidth: 300,
            type: {
              render: (jobId) =>
                jobId ? (
                  <Id
                    to={makeUrl(`/risk-levels/${jobUrl}/simulation-history/:jobId`, {
                      jobId: jobId,
                    })}
                  >
                    {jobId}
                  </Id>
                ) : (
                  <></>
                ),
            },
          }),
          helper.simple<'createdAt'>({
            title: 'Created at',
            key: 'createdAt',
            sorting: true,
            type: DATE,
          }),
          helper.simple<'createdBy'>({
            title: 'Created by',
            key: 'createdBy',
            defaultWidth: 300,
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
          helper.simple<'iterations'>({
            title: 'Status',
            key: 'iterations',
            type: SIMULATION_STATUS,
          }),
        ])}
        hideFilters={true}
      />
    </PageWrapperContentContainer>
  );
}
