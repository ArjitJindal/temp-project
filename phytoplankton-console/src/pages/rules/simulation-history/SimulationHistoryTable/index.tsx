import React, { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/api';
import { SimulationBeaconJob } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import COLORS from '@/components/ui/colors';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { SIMULATION_JOBS } from '@/utils/queries/keys';
import { useUsers } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE, NUMBER, SIMULATION_STATUS } from '@/components/library/Table/standardDataTypes';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import { DefaultApiGetSimulationsRequest } from '@/apis/types/ObjectParamAPI';
import { useRules } from '@/utils/rules';
import { makeUrl } from '@/utils/routing';
import { SuperAdminModeContext } from '@/components/AppWrapper/Providers/SuperAdminModeProvider';

export function SimulationHistoryTable(props: { rulesTab: string }) {
  const api = useApi();
  const { rules } = useRules();
  const [users, loading] = useUsers({ includeRootUsers: true, includeBlockedUsers: true });
  const [params, setParams] = useState<AllParams<DefaultApiGetSimulationsRequest>>({
    ...DEFAULT_PARAMS_STATE,
    page: 1,
    type: 'BEACON',
  });
  const context = useContext(SuperAdminModeContext);
  const finalParams = useMemo(
    () => ({ ...params, includeInternal: context?.isSuperAdminMode }),
    [context?.isSuperAdminMode, params],
  );
  const queryResults = usePaginatedQuery(SIMULATION_JOBS(finalParams), async (paginationParams) => {
    const simulations = await api.getSimulations({ ...finalParams, ...paginationParams });
    return {
      items: simulations.data as SimulationBeaconJob[],
      total: simulations.total,
    };
  });

  const helper = new ColumnHelper<SimulationBeaconJob>();
  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<SimulationBeaconJob, typeof params>
        rowKey="jobId"
        queryResults={queryResults}
        params={params}
        onChangeParams={setParams}
        paginationBorder
        pagination={true}
        columns={helper.list([
          helper.derived({
            title: 'Simulation ID',
            sorting: true,
            value: (item) => item,
            type: {
              render: (job) =>
                job ? (
                  <Link
                    style={{ color: COLORS.brandBlue.base }}
                    to={makeUrl(`/rules/:rulesTab/simulation-history/:id`, {
                      rulesTab: props.rulesTab,
                      id: job.jobId,
                    })}
                  >
                    {job.jobId}
                  </Link>
                ) : (
                  <></>
                ),
            },
          }),
          helper.derived({
            title: 'Rule ID',
            sorting: true,
            defaultWidth: 300,
            value: (item) => item,
            type: {
              render: (item) => (
                <>
                  {item?.defaultRuleInstance?.ruleId || 'RC'} <br />
                  {item?.defaultRuleInstance?.ruleNameAlias ||
                    item?.iterations[0]?.parameters?.ruleInstance?.ruleNameAlias}
                </>
              ),
            },
          }),
          helper.derived({
            title: 'Description',
            sorting: true,
            value: (item) => item,
            type: {
              render: (item) => (
                <span>
                  {item?.defaultRuleInstance?.ruleDescriptionAlias ||
                    (item?.defaultRuleInstance?.ruleId &&
                      rules?.[item?.defaultRuleInstance.ruleId]?.description) ||
                    item?.iterations[0]?.parameters?.ruleInstance?.ruleDescriptionAlias ||
                    '-'}
                </span>
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
