import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import {
  DASHBOARD_TRANSACTIONS_STATS,
  DASHBOARD_TRANSACTIONS_TOTAL_STATS,
  USERS_STATS,
  DASHBOARD_OVERVIEW,
  DASHBOARD_TEAM_SLA_STATS,
  DASHBOARD_STATS_QA_ALERTS_BY_RULE_HIT,
  CLOSING_REASON_DISTRIBUTION,
  DASHBOARD_STATS_QA_OVERVIEW,
  DASHBOARD_STATS_QA_ALERTS_BY_ASSIGNEE,
  DASHBOARD_STATS_QA_ALERT_STATS_BY_CHECKLIST_REASON,
  ALERT_PRIORITY_DISTRIBUTION,
  HITS_PER_USER,
  RULES_HIT_STATS,
  DASHBOARD_TEAM_STATS,
  DASHBOARD_TEAM_STATS_LATEST,
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

export function useDashboardOverview() {
  const api = useApi();
  return useQuery(DASHBOARD_OVERVIEW(), async () => {
    return await api.getDashboardStatsOverview({});
  });
}

export function useDashboardTeamSlaStats(params: any) {
  const api = useApi();
  return useQuery(DASHBOARD_TEAM_SLA_STATS(params), async () => {
    const data = await api.getDashboardTeamSlaStats(params);
    return { items: data.items, total: data.total };
  });
}

export function useDashboardTransactionsTypeDistribution(params: any) {
  const api = useApi();
  return useQuery(DASHBOARD_TRANSACTIONS_TOTAL_STATS(params), async () => {
    return await api.getDashboardTransactionsTypeDistribution(params);
  });
}

export function useCaseAlertStatusDistribution(params: any) {
  const api = useApi();
  return useQuery(DASHBOARD_TRANSACTIONS_STATS(params), async () => {
    return await api.getDashboardStatsAlertAndCaseStatusDistributionStats(params);
  });
}

export function useQaAlertsByRuleHits(dateRange: any) {
  const api = useApi();
  return useQuery(DASHBOARD_STATS_QA_ALERTS_BY_RULE_HIT(dateRange), async () => {
    const [start, end] = dateRange ?? [];
    const startTimestamp = start?.startOf?.('day')?.valueOf?.();
    const endTimestamp = end?.endOf?.('day')?.valueOf?.();
    const result = await api.getDashboardStatsQaAlertsByRuleHit({ startTimestamp, endTimestamp });
    return { total: result.data.length, items: result.data };
  });
}

export function useClosingReasonDistribution(entity: 'CASE' | 'ALERT' | 'PAYMENT', params: any) {
  const api = useApi();
  return useQuery(CLOSING_REASON_DISTRIBUTION(entity, params), async () => {
    return await api.getDashboardStatsClosingReasonDistributionStats(params);
  });
}

export function useQaOverview(dateRange: any) {
  const api = useApi();
  return useQuery(DASHBOARD_STATS_QA_OVERVIEW(dateRange), async () => {
    const [start, end] = dateRange ?? [];
    const startTimestamp = start?.startOf?.('day')?.valueOf?.();
    const endTimestamp = end?.endOf?.('day')?.valueOf?.();
    return await api.getDashboardStatsQaOverview({ startTimestamp, endTimestamp });
  });
}

export function useQaAlertsByAssignee(dateRange: any) {
  const api = useApi();
  return useQuery(DASHBOARD_STATS_QA_ALERTS_BY_ASSIGNEE(dateRange), async () => {
    const [start, end] = dateRange ?? [];
    const startTimestamp = start?.startOf?.('day')?.valueOf?.();
    const endTimestamp = end?.endOf?.('day')?.valueOf?.();
    const result = await api.getDashboardStatsQaAlertsByAssignee({ startTimestamp, endTimestamp });
    return { total: result.data.length, items: result.data };
  });
}

export function useQaAlertStatsByChecklistReason(params: {
  dateRange: any;
  checklistTemplateId?: string;
  checklistCategory?: string;
}) {
  const api = useApi();
  const { dateRange, checklistTemplateId, checklistCategory } = params;
  return useQuery(
    DASHBOARD_STATS_QA_ALERT_STATS_BY_CHECKLIST_REASON(
      dateRange,
      checklistTemplateId ?? '',
      checklistCategory ?? '',
    ),
    async () => {
      if (!(checklistTemplateId && checklistCategory)) {
        return { total: 0, items: [] } as any;
      }
      const [start, end] = dateRange ?? [];
      const startTimestamp = start?.startOf?.('day')?.valueOf?.();
      const endTimestamp = end?.endOf?.('day')?.valueOf?.();
      const result = await api.getDashboardStatsQaAlertsStatsByChecklistReason({
        startTimestamp,
        endTimestamp,
        checklistTemplateId,
        checklistCategory,
      });
      return { total: result.data.length, items: result.data } as any;
    },
  );
}

export function useAlertPriorityDistribution(params: any) {
  const api = useApi();
  return useQuery(ALERT_PRIORITY_DISTRIBUTION(params), async () => {
    return await api.getDashboardStatsAlertPriorityDistributionStats(params);
  });
}

export function useTopUsersByRuleHit(
  dateRange: any,
  userType: 'BUSINESS' | 'CONSUMER',
  direction?: 'ORIGIN' | 'DESTINATION',
) {
  const api = useApi();
  return usePaginatedQuery(
    HITS_PER_USER(dateRange, userType, direction),
    async (paginationParams) => {
      const [start, end] = dateRange ?? [];
      const startTimestamp = start?.startOf?.('day')?.valueOf?.();
      const endTimestamp = end?.endOf?.('day')?.valueOf?.();
      const result = await api.getDashboardStatsHitsPerUser({
        ...paginationParams,
        startTimestamp,
        endTimestamp,
        direction,
        userType,
      });
      return {
        total: result.data.length,
        items: result.data,
      };
    },
  );
}

export function useRulesHitStats(dateRange: any, page?: number, pageSize?: number) {
  const api = useApi();
  return usePaginatedQuery(RULES_HIT_STATS(dateRange, page, pageSize), async (paginationParams) => {
    const [start, end] = dateRange ?? [];
    const startTimestamp = start?.startOf?.('day')?.valueOf?.();
    const endTimestamp = end?.endOf?.('day')?.valueOf?.();
    const result = await api.getDashboardStatsRuleHit({
      startTimestamp,
      endTimestamp,
      page: paginationParams?.page ?? page,
      pageSize: paginationParams?.pageSize ?? pageSize,
    });
    return {
      items: result.data,
      total: result.total,
    };
  });
}

export function useTeamPerformanceStats(params: {
  scope: any;
  caseStatus?: any;
  dateRange: any;
  page?: number;
  pageSize?: number;
}) {
  const api = useApi();
  return usePaginatedQuery(DASHBOARD_TEAM_STATS(params) as unknown as any, async (p) => {
    const [start, end] = params.dateRange ?? [];
    let startTimestamp, endTimestamp;
    if (start != null && end != null) {
      startTimestamp = start.startOf?.('day')?.valueOf?.();
      endTimestamp = end.endOf?.('day')?.valueOf?.();
    }
    const response = await api.getDashboardTeamStats({
      scope: params.scope,
      startTimestamp,
      endTimestamp,
      caseStatus: params.caseStatus,
      page: p?.page ?? params.page,
      pageSize: p?.pageSize ?? params.pageSize,
    });

    const updatedItems = response.items?.map((item: any) => ({
      ...item,
      investigationTime:
        item.investigationTime && item.caseIds?.length
          ? item.investigationTime / item.caseIds.length
          : 0,
    }));

    return {
      total: response.total,
      items: updatedItems,
    };
  });
}

export function useLatestTeamStats(params: { scope: any; page?: number; pageSize?: number }) {
  const api = useApi();
  return usePaginatedQuery(DASHBOARD_TEAM_STATS_LATEST(params) as unknown as any, async (p) => {
    const response = await api.getDashboardLatestTeamStats({
      scope: params.scope,
      page: p?.page ?? params.page,
      pageSize: p?.pageSize ?? params.pageSize,
    });
    return {
      total: response.total,
      items: response.items,
    };
  });
}
