import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import {
  DASHBOARD_TRANSACTIONS_STATS,
  DASHBOARD_TRANSACTIONS_TOTAL_STATS,
  USERS_STATS,
} from '@/utils/queries/keys';

export function useDashboardTransactionsStats(params: any) {
  const api = useApi();
  return useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsTransactions(params);
  });
}

export function useDashboardTransactionsTotalStats(params: any) {
  const api = useApi();
  return useQuery(DASHBOARD_TRANSACTIONS_TOTAL_STATS(params), async () => {
    return await api.getDashboardStatsTransactionsTotal(params);
  });
}

export function useDashboardUsersStats(params: any) {
  const api = useApi();
  return useQuery(USERS_STATS(params), async () => {
    return await api.getDashboardStatsUsersByTime(params);
  });
}
