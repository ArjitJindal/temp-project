import { useApi } from '@/api';
import {
  DEFAULT_MANUAL_SCREENING_FILTERS,
  SANCTIONS_HITS_SEARCH,
  SANCTIONS_SCREENING_DETAILS,
  SANCTIONS_SCREENING_STATS,
  SANCTIONS_SEARCH,
  SANCTIONS_SEARCH_HISTORY,
  SANCTIONS_SOURCES,
  SANCTIONS_WHITELIST_SEARCH,
  SCREENING_PROFILES,
  SEARCH_PROFILES,
  SANCTIONS_BULK_SEARCH,
  SANCTIONS_BULK_SEARCH_TERM,
  SANCTIONS_BULK_SEARCH_TERM_HISTORY,
} from '@/utils/queries/keys';
import { useCursorQuery, usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { SanctionsDataProviderName } from '@/apis/models/SanctionsDataProviderName';
import {
  GenericSanctionsSearchType,
  SearchProfileResponse,
  ScreeningProfileResponse,
  FileInfo,
} from '@/apis';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { map } from '@/utils/queries/types';
import { SanctionsSearchHistoryItem } from '@/apis/models/SanctionsSearchHistoryItem';

export const useDefaultManualScreeningFilters = () => {
  const api = useApi();
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
  const isScreeningProfileEnabled =
    hasFeatureAcuris || hasFeatureDowJones || hasFeatureOpenSanctions;
  return useQuery(
    DEFAULT_MANUAL_SCREENING_FILTERS(),
    async () => {
      return await api.getDefaultManualScreeningFilters();
    },
    { enabled: isScreeningProfileEnabled },
  );
};

export const useSanctionsSearch = (params) => {
  const api = useApi();
  const queryResult = useCursorQuery(SANCTIONS_SEARCH(params), ({ from }) => {
    const { createdAt, searchTerm, types, searchedBy, ...rest } = params;
    const [start, end] = createdAt ?? [];
    return api.getSanctionsSearch({
      afterTimestamp: start ? start.startOf('day').valueOf() : 0,
      beforeTimestamp: end ? end.endOf('day').valueOf() : Number.MAX_SAFE_INTEGER,
      searchTerm,
      types,
      start: from,
      filterSearchedBy: searchedBy,
      ...rest,
    });
  });

  return map(queryResult, (data) => ({
    ...data,
    items: data.items.map((item: SanctionsSearchHistoryItem) => ({
      ...item,
      rowKey: item.batchId ? `${item.batchId}-${item._id}` : item._id,
    })),
  }));
};

export const useSanctionsSources = ({
  provider,
  filterSourceType,
  searchTerm,
}: {
  provider?: SanctionsDataProviderName;
  filterSourceType: GenericSanctionsSearchType;
  searchTerm?: string;
}) => {
  const api = useApi();
  return useQuery(SANCTIONS_SOURCES(provider, filterSourceType, searchTerm), () =>
    api.getSanctionsSources({ provider, filterSourceType, searchTerm }),
  );
};

export const useSanctionsWhitelist = (params) => {
  const api = useApi();
  return useCursorQuery(SANCTIONS_WHITELIST_SEARCH(params), ({ from }) => {
    return api.searchSanctionsWhitelist({
      start: from || params.from,
      pageSize: params.pageSize,
      filterUserId: params.userId ? [params.userId] : undefined,
      filterEntity: params.entity ? [params.entity] : undefined,
      filterEntityType: params.entityType ? [params.entityType] : undefined,
    });
  });
};

export const useSanctionsScreeningStats = (params) => {
  const api = useApi();
  return useQuery(SANCTIONS_SCREENING_STATS(params), () =>
    api.getSanctionsScreeningActivityStats(params),
  );
};

export const useSanctionsScreeningDetails = (params) => {
  const api = useApi();
  return usePaginatedQuery(SANCTIONS_SCREENING_DETAILS(params), async (paginationParams) => {
    const result = await api.getSanctionsScreeningActivityDetails({
      page: params.page,
      pageSize: params.pageSize,
      from: params.from,
      filterEntities: params.entity,
      filterName: params.name,
      filterIsHit: params.isHit,
      filterIsNew: params.isNew,
      afterTimestamp: params.afterTimestamp,
      beforeTimestamp: params.beforeTimestamp,
      ...paginationParams,
    });
    return {
      items: result.data,
      total: result.total,
    };
  });
};

export const useSanctionHitsQuery = (params, alertId?: string) => {
  const api = useApi();
  const filters = {
    alertId: alertId,
    filterStatus: params.statuses ?? ['OPEN'],
    filterSearchId: params.searchIds,
    filterPaymentMethodId: params.paymentMethodIds,
    filterScreeningHitEntityType: params.entityType,
  };
  return useCursorQuery(
    SANCTIONS_HITS_SEARCH({ ...filters, ...params }),
    async (paginationParams) => {
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
      const request = {
        ...filters,
        ...params,
        ...paginationParams,
      };
      return await api.searchSanctionsHits({
        ...request,
        start: request.from,
      });
    },
  );
};

export const useSanctionsSearchHistory = (searchId: string, params) => {
  const api = useApi();
  return useQuery(
    SANCTIONS_SEARCH_HISTORY(searchId, params),
    () => api.getSanctionsSearchSearchId({ searchId, ...params }),
    { enabled: !!searchId },
  );
};

export const useSearchProfiles = (filters) => {
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
  const isScreeningProfileEnabled =
    hasFeatureAcuris || hasFeatureDowJones || hasFeatureOpenSanctions;
  const api = useApi();
  return useQuery(
    SEARCH_PROFILES(filters),
    async () => {
      const response = await api.getSearchProfiles(filters);
      return {
        items: response.items || [],
        total: response.items?.length || 0,
      };
    },
    { enabled: !isScreeningProfileEnabled },
  );
};

export const useScreeningProfiles = (filters) => {
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
  const isScreeningProfileEnabled =
    hasFeatureAcuris || hasFeatureDowJones || hasFeatureOpenSanctions;
  const api = useApi();
  return useQuery(
    SCREENING_PROFILES(filters),
    async () => {
      const response = await api.getScreeningProfiles(filters);
      return {
        items: response.items || [],
        total: response.items?.length || 0,
      };
    },
    { enabled: isScreeningProfileEnabled },
  );
};

export const useDeleteSanctionsWhitelist = (onRefetch?: () => void) => {
  const api = useApi();
  return useMutation<unknown, unknown, { ids: string[] }>(
    async (variables) => {
      return api.deleteSanctionsWhitelistRecords({ request_body: variables.ids });
    },
    {
      onSuccess: () => {
        message.success('Record deleted successfully');
        onRefetch?.();
      },
      onError: (e) => {
        message.fatal(`Failed to delete record: ${getErrorMessage(e)}`, e);
      },
    },
  );
};

export const useSearchProfileMutations = (onRefetch?: () => void) => {
  const api = useApi();

  const updateStatusMutation = useMutation(
    async ({
      searchProfileId,
      status,
      item,
    }: {
      searchProfileId: string;
      status: 'ENABLED' | 'DISABLED';
      item: SearchProfileResponse;
    }) => {
      await api.updateSearchProfile({
        searchProfileId,
        SearchProfileRequest: {
          searchProfileName: item.searchProfileName || '',
          searchProfileDescription: item.searchProfileDescription || '',
          searchProfileStatus: status,
          isDefault: item.isDefault || false,
        },
      });
    },
    {
      onSuccess: () => {
        message.success('Search profile status updated successfully');
        onRefetch?.();
      },
      onError: (error: Error) => {
        message.error(`Failed to update search profile status: ${error.message}`);
      },
    },
  );

  const deleteSearchProfileMutation = useMutation(
    async (searchProfileId: string) => {
      await api.deleteSearchProfile({ searchProfileId });
    },
    {
      onSuccess: () => {
        message.success('Search profile deleted successfully');
        onRefetch?.();
      },
      onError: (error: Error) => {
        message.error(`Failed to delete search profile: ${error.message}`);
      },
    },
  );

  const duplicateSearchProfileMutation = useMutation(
    async (item: SearchProfileResponse) => {
      await api.postSearchProfiles({
        SearchProfileRequest: {
          searchProfileName: `${item.searchProfileName} (Copy)`,
          searchProfileDescription: item.searchProfileDescription || '',
          searchProfileStatus: item.searchProfileStatus || 'DISABLED',
          isDefault: false,
          nationality: item.nationality || [],
          types: item.types || [],
          fuzziness: item.fuzziness,
        },
      });
    },
    {
      onSuccess: () => {
        message.success('Search profile duplicated successfully');
        onRefetch?.();
      },
      onError: (error: Error) => {
        message.error(`Failed to duplicate search profile: ${error.message}`);
      },
    },
  );

  return { updateStatusMutation, deleteSearchProfileMutation, duplicateSearchProfileMutation };
};

export const useSanctionsBulkSearch = () => {
  const api = useApi();
  return useMutation(
    async ({ file, reason, filters }: { file: FileInfo; reason: string; filters: any }) => {
      return api.postSanctionsBulkSearch({
        SanctionsBulkSearchRequest: {
          file,
          reason,
          filters,
        },
      });
    },
    {
      onError: (e) => {
        message.fatal(`Failed to start bulk screening. ${getErrorMessage(e)}`, e);
      },
    },
  );
};

export const useSanctionsBulkSearchItems = (
  opts?: {
    batchId?: string;
    from?: string;
    pageSize?: number;
  },
  options?: { enabled?: boolean },
) => {
  const api = useApi();
  return useCursorQuery(
    SANCTIONS_BULK_SEARCH(opts?.batchId, opts),
    async ({ from }) => {
      return api.getSanctionsBulkSearch({
        batchId: opts?.batchId,
        start: opts?.from ?? from,
        pageSize: opts?.pageSize,
      });
    },
    { enabled: options?.enabled ?? true },
  );
};

export const useSanctionsBulkSearchResultMap = (searchTermId?: string) => {
  const api = useApi();
  return useQuery(
    SANCTIONS_BULK_SEARCH_TERM(searchTermId),
    async () => api.getSanctionsBulkSearchSearchTermId({ searchTermId: searchTermId ?? '' }),
    { enabled: !!searchTermId },
  );
};

export const useSanctionsBulkSearchTermHistory = (
  searchTermId: string | undefined,
  params: { page?: number; pageSize?: number },
  options?: { enabled?: boolean },
) => {
  const api = useApi();
  return useQuery(
    SANCTIONS_BULK_SEARCH_TERM_HISTORY(searchTermId, params),
    () =>
      api.getSanctionsBulkSearchSearchTermId({
        searchTermId: searchTermId ?? '',
        page: params.page,
        pageSize: params.pageSize,
      }),
    { enabled: (!!searchTermId && (options?.enabled ?? true)) || false },
  );
};

export const useScreeningProfileMutations = (onRefetch?: () => void) => {
  const api = useApi();

  const updateStatusMutation = useMutation(
    async ({
      screeningProfileId,
      status,
      item,
    }: {
      screeningProfileId: string;
      status: 'ENABLED' | 'DISABLED';
      item: ScreeningProfileResponse;
    }) => {
      await api.updateScreeningProfile({
        screeningProfileId,
        ScreeningProfileRequest: {
          screeningProfileName: item.screeningProfileName || '',
          screeningProfileDescription: item.screeningProfileDescription || '',
          screeningProfileStatus: status,
          isDefault: item.isDefault || false,
        },
      });
    },
    {
      onSuccess: () => {
        message.success('Screening profile status updated successfully');
        onRefetch?.();
      },
      onError: (error: Error) => {
        message.fatal(error.message || 'Failed to update screening profile status');
      },
    },
  );

  const deleteScreeningProfileMutation = useMutation(
    async (screeningProfileId: string) => {
      await api.deleteScreeningProfile({ screeningProfileId });
    },
    {
      onSuccess: () => {
        message.success('Screening profile deleted successfully');
        onRefetch?.();
      },
      onError: (error: Error) => {
        message.fatal(error.message || 'Failed to delete screening profile');
      },
    },
  );

  const duplicateScreeningProfileMutation = useMutation(
    async (item: ScreeningProfileResponse) => {
      await api.postScreeningProfiles({
        ScreeningProfileRequest: {
          screeningProfileName: `${item.screeningProfileName} (Copy)`,
          screeningProfileDescription: item.screeningProfileDescription || '',
          screeningProfileStatus: item.screeningProfileStatus || 'DISABLED',
          isDefault: false,
          sanctions: item.sanctions,
          pep: item.pep,
          rel: item.rel,
          adverseMedia: item.adverseMedia,
        },
      });
    },
    {
      onSuccess: () => {
        message.success('Screening profile duplicated successfully');
        onRefetch?.();
      },
      onError: (error: Error) => {
        message.fatal(error.message || 'Failed to duplicate screening profile');
      },
    },
  );

  return {
    updateStatusMutation,
    deleteScreeningProfileMutation,
    duplicateScreeningProfileMutation,
  };
};

export const useUpdateDefaultManualScreeningFilters = () => {
  const api = useApi();
  return useMutation(
    async (variables: { DefaultManualScreeningFiltersRequest }) => {
      await api.postDefaultManualScreeningFilters(variables);
    },
    {
      onSuccess: () => {
        message.success('Default filters updated successfully');
      },
      onError: (error: Error) => {
        message.fatal(`Failed to update default filters: ${error.message}`);
      },
    },
  );
};
