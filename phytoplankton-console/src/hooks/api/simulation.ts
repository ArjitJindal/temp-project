import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_COUNT, SIMULATION_JOB } from '@/utils/queries/keys';
import type { SimulationBeaconJob } from '@/apis';

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
