import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import {
  DEFAULT_MANUAL_SCREENING_FILTERS,
  SCREENING_PROFILES,
  SEARCH_PROFILES,
  SANCTIONS_SEARCH_HISTORY,
} from '@/utils/queries/keys';

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
