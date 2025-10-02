import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_COUNT } from '@/utils/queries/keys';

export function useSimulationCount(enabled: boolean = true) {
  const api = useApi();
  return useQuery(SIMULATION_COUNT(), async () => api.getSimulationJobsCount(), {
    enabled,
  });
}
