import { useQuery } from './queries/hooks';
import { ACTION_REASONS } from './queries/keys';
import { getOr } from './asyncResource';
import { useApi } from '@/api';
import { ReasonType } from '@/apis';

export const useReasons = (type?: ReasonType, filterInactive: boolean = true) => {
  const api = useApi();
  const asyncResourceReasons = useQuery(ACTION_REASONS(type), async () => {
    return await api.getActionReasons({ type });
  });
  const actionReasons = getOr(asyncResourceReasons.data, []);
  return actionReasons
    .filter((val) => (filterInactive ? val.isActive : true))
    .map((data) => data.reason);
};

/**
 * Get combined closure and escalation reasons for filtering
 */
export const useCombinedReasons = (filterInactive: boolean = true) => {
  const closureReasons = useReasons('CLOSURE', filterInactive);
  const escalationReasons = useReasons('ESCALATION', filterInactive);

  // Combine and deduplicate reasons
  const combinedReasons = [...new Set([...closureReasons, ...escalationReasons])];
  return combinedReasons.sort(); // Sort alphabetically for consistent ordering
};
