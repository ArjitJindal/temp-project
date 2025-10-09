import { useApi } from '@/api';
import { useQuery, usePaginatedQuery } from '@/utils/queries/hooks';
import {
  SIMULATION_COUNT,
  SIMULATION_JOB,
  SIMULATION_JOBS,
  SIMULATION_JOB_ITERATION_RESULT,
} from '@/utils/queries/keys';
import type {
  SimulationBeaconJob,
  SimulationRiskLevelsJob,
  SimulationBeaconTransactionResult,
  SimulationBeaconResultUser,
} from '@/apis';
import { dayjs } from '@/utils/dayjs';

export function useSimulationCount(enabled: boolean = true) {
  const api = useApi();
  return useQuery(SIMULATION_COUNT(), async () => api.getSimulationJobsCount(), {
    enabled,
  });
}

export function useSimulationJob(jobId?: string, refetchMs?: number) {
  const api = useApi();
  return useQuery(
    SIMULATION_JOB(jobId ?? ''),
    () =>
      api.getSimulationTestId({
        jobId: jobId ?? '',
      }) as Promise<SimulationBeaconJob>,
    {
      enabled: Boolean(jobId),
      refetchInterval: refetchMs,
    },
  );
}

export function useSimulationHistory(params: any) {
  const api = useApi();
  return usePaginatedQuery(SIMULATION_JOBS(params), async (paginationParams) => {
    const simulations = await api.getSimulations({ ...params, ...paginationParams });
    return {
      items: simulations.data as SimulationBeaconJob[],
      total: simulations.total,
    };
  });
}

export function useRiskClassificationSimulationHistory(params: any) {
  const api = useApi();
  return usePaginatedQuery(SIMULATION_JOBS(params), async (paginationParams) => {
    const simulations = await api.getSimulations({
      type: params.type,
      page: params.page ?? 1,
      pageSize: params.pageSize,
      ...paginationParams,
      sortField: params.sort[0]?.[0],
      sortOrder: params.sort[0]?.[1] ?? 'ascend',
      includeInternal: params?.includeInternal,
    });

    return {
      items: simulations.data as SimulationRiskLevelsJob[],
      total: simulations.total,
    };
  });
}

export function useRiskFactorsSimulationHistory(params: any) {
  const api = useApi();
  return usePaginatedQuery(SIMULATION_JOBS(params), async (paginationParams) => {
    const simulations = await api.getSimulations({
      type: params.type,
      page: params.page ?? 1,
      pageSize: params.pageSize,
      ...paginationParams,
      sortField: params.sort[0]?.[0],
      sortOrder: params.sort[0]?.[1] ?? 'ascend',
      includeInternal: params?.includeInternal,
    });

    return {
      items: simulations.data,
      total: simulations.total,
    };
  });
}

export function useSimulationTransactionResults(taskId: string, params: any) {
  const api = useApi();
  return usePaginatedQuery(
    SIMULATION_JOB_ITERATION_RESULT(taskId, params),
    async (paginationParams) => {
      const { timestamp, ...restParams } = params;
      const response = await api.getSimulationTaskIdResult({
        taskId,
        ...restParams,
        page: paginationParams.page || params.page,
        pageSize: params.pageSize,
        filterType: 'BEACON_TRANSACTION',
        filterTransactionId: params.transactionId,
        filterHitStatus: params.hit,
        filterStartTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : undefined,
        filterEndTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : undefined,
        filterOriginPaymentMethod: params.originPaymentMethod,
        filterDestinationPaymentMethod: params.destinationPaymentMethod,
        filterTransactionTypes: params.transactionTypes,
        filterUserId: params.userId,
      });
      return {
        items: response.items as SimulationBeaconTransactionResult[],
        total: response.total,
      };
    },
  );
}

export function useSimulationUserResults(taskId: string, params: any) {
  const api = useApi();
  return usePaginatedQuery<SimulationBeaconResultUser>(
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
        filterHitStatus: params.hit,
      });

      return {
        items: response.items as SimulationBeaconResultUser[],
        total: response.total,
      };
    },
  );
}
