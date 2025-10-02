import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { isSuccess } from '@/utils/asyncResource';
import { GraphNodes, GraphEdges } from '@/apis';

export type EntityFilters = { afterTimestamp?: number; beforeTimestamp?: number };

export function useUserEntity(
  userId: string,
  filters?: EntityFilters,
  options?: { enabled?: boolean },
): { nodes: GraphNodes[]; edges: GraphEdges[] } | undefined {
  const api = useApi();
  const queryResult = useQuery(
    ['user-entity', userId, filters],
    () => api.getUserEntity({ userId, ...(filters || {}) }),
    { enabled: (options?.enabled ?? true) && !!userId },
  );

  return isSuccess(queryResult.data) ? queryResult.data.value : undefined;
}

export function useTxnEntity(
  userId: string,
  filters?: EntityFilters,
  options?: { enabled?: boolean },
): { nodes: GraphNodes[]; edges: GraphEdges[] } | undefined {
  const api = useApi();
  const queryResult = useQuery(
    ['txn-entity', userId, filters],
    () => api.getTxnLinking({ userId, ...(filters || {}) }),
    { enabled: (options?.enabled ?? true) && !!userId },
  );
  return isSuccess(queryResult.data) ? queryResult.data.value : undefined;
}
