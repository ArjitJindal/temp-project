import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api';
import { useCursorQuery, useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  DEFAULT_MANUAL_SCREENING_FILTERS,
  SCREENING_PROFILES,
  SEARCH_PROFILES,
  SANCTIONS_SEARCH_HISTORY,
  ALERT_ITEM_TRANSACTION_STATS,
  SANCTIONS_HITS_SEARCH,
  ALERT_ITEM_COMMENTS,
  SANCTIONS_HITS_ALL,
} from '@/utils/queries/keys';
import type { SanctionsHitListResponse } from '@/apis';
import type { Mutation } from '@/utils/queries/types';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

export function useSearchProfiles(
  params?: { filterSearchProfileStatus?: 'ENABLED' | 'DISABLED' },
  options?: { enabled?: boolean; staleTime?: number },
) {
  const api = useApi();
  return useQuery(
    SEARCH_PROFILES(params),
    async () => {
      const response = await api.getSearchProfiles(params ?? {});
      return {
        items: response.items || [],
        total: response.items?.length || 0,
      };
    },
    options,
  );
}

export function useScreeningProfiles(
  params?: { filterScreeningProfileStatus?: 'ENABLED' | 'DISABLED' },
  options?: { enabled?: boolean; staleTime?: number },
) {
  const api = useApi();
  return useQuery(
    SCREENING_PROFILES(params),
    async () => {
      const response = await api.getScreeningProfiles(params ?? {});
      return {
        items: response.items || [],
        total: response.items?.length || 0,
      };
    },
    options,
  );
}

export function useDefaultManualScreeningFilters(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(
    DEFAULT_MANUAL_SCREENING_FILTERS(),
    async () => api.getDefaultManualScreeningFilters(),
    { enabled: options?.enabled, refetchOnMount: true, refetchOnWindowFocus: true },
  );
}

export function useSanctionsSearchHistory(
  searchId: string | undefined,
  params: { page?: number; pageSize?: number } | undefined,
  options?: { enabled?: boolean },
) {
  const api = useApi();
  return useQuery(
    SANCTIONS_SEARCH_HISTORY(searchId, params),
    async () => {
      if (searchId == null) {
        throw new Error('searchId is required');
      }
      return api.getSanctionsSearchSearchId({
        searchId: searchId,
        page: params?.page,
        pageSize: params?.pageSize,
      });
    },
    { enabled: options?.enabled },
  );
}

export function useSelectedSearchProfile(
  searchProfileId: string | undefined,
  options?: { enabled?: boolean },
) {
  const api = useApi();
  return useQuery(
    ['selected-search-profile', searchProfileId],
    async () => {
      if (!searchProfileId) {
        return null;
      }
      const response = await api.getSearchProfiles({
        filterSearchProfileId: [searchProfileId],
      });
      return response.items?.[0] || null;
    },
    { enabled: options?.enabled },
  );
}

export function useAlertTransactionStats(alertId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(
    ALERT_ITEM_TRANSACTION_STATS(alertId),
    () => {
      if (!alertId) {
        throw new Error(`Alert id can not be empty`);
      }
      return api.getAlertTransactionStats({ alertId, referenceCurrency: 'USD' });
    },
    options,
  );
}

export function useSanctionsHitsSearch(
  params: Record<string, any>,
  alertId?: string,
  enabled?: boolean,
) {
  const api = useApi();
  const filters = {
    alertId,
    filterStatus: params.statuses ?? ['OPEN' as const],
    filterSearchId: params.searchIds,
    filterPaymentMethodId: params.paymentMethodIds,
    filterScreeningHitEntityType: params.entityType,
  };
  return useCursorQuery(
    SANCTIONS_HITS_SEARCH({ ...filters, ...params }),
    async (paginationParams): Promise<SanctionsHitListResponse> => {
      if (!filters.alertId) {
        return {
          items: [],
          next: '',
          prev: '',
          last: '',
          hasNext: false,
          hasPrev: false,
          count: 0,
          limit: 100000,
        };
      }
      const request = { ...filters, ...params, ...paginationParams };
      return await api.searchSanctionsHits({ ...request, start: request.from });
    },
    { enabled: enabled !== false },
  );
}

export function useChangeSanctionsHitsStatusMutation(): {
  changeHitsStatusMutation: Mutation<
    unknown,
    unknown,
    {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: any;
    }
  >;
} {
  const api = useApi();
  const queryClient = useQueryClient();

  const changeHitsStatusMutation = useMutation<
    unknown,
    unknown,
    {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: any;
    },
    unknown
  >(
    async (variables) => {
      const hideMessage = message.loading(`Saving...`);
      const { toChange, updates } = variables;
      try {
        for (const { alertId, sanctionHitIds } of toChange) {
          await api.changeSanctionsHitsStatus({
            SanctionHitsStatusUpdateRequest: {
              alertId,
              sanctionHitIds,
              updates,
            },
          });
        }
      } finally {
        hideMessage();
      }
    },
    {
      onError: (e) => {
        message.error(`Failed to update hits! ${getErrorMessage(e)}`);
      },
      onSuccess: async (_, variables) => {
        message.success(`Done!`);
        await queryClient.invalidateQueries(SANCTIONS_HITS_ALL());
        for (const { alertId } of variables.toChange) {
          await queryClient.invalidateQueries(ALERT_ITEM_COMMENTS(alertId));
        }
      },
    },
  );

  return { changeHitsStatusMutation };
}
