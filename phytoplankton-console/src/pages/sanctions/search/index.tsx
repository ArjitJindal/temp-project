import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreeningHitTable from '@/components/ScreeningHitTable';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import {
  OccupationCode,
  GenericSanctionsSearchType,
  SanctionsSearchRequestEntityType,
} from '@/apis';
import { getOr, isLoading, isSuccess, map } from '@/utils/asyncResource';
import { map as mapQuery } from '@/utils/queries/types';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  DEFAULT_MANUAL_SCREENING_FILTERS,
  SANCTIONS_SEARCH_HISTORY,
  SCREENING_PROFILES,
  SEARCH_PROFILES,
} from '@/utils/queries/keys';
import { isSuperAdmin, useAuth0User, useHasResources } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import { message } from '@/components/library/Message';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { getErrorMessage } from '@/utils/lang';
import { ScreeningSearchBar } from '@/components/ScreeningHitTable/ScreeningSearchBar';
import { sanitizeFuzziness } from '@/components/ScreeningHitTable/utils';

interface TableSearchParams {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirthRange?: [string, string];
  types?: Array<GenericSanctionsSearchType>;
  nationality?: Array<string>;
  occupationCode?: Array<OccupationCode>;
  documentId?: string;
  searchProfileId?: string;
  screeningProfileId?: string;
  entityType?: SanctionsSearchRequestEntityType;
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  countryOfResidence?: Array<string>;
  registrationId?: string;
}

interface Props {
  searchId?: string;
  setSearchTerm: (searchTerm: string) => void;
}

export function SearchResultTable(props: Props) {
  const { searchId, setSearchTerm } = props;
  const api = useApi();
  const currentUser = useAuth0User();
  const hasSetDefaultProfile = useRef(false);
  const hasSetDefaultManualFilters = useRef(false);
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
  const isScreeningProfileEnabled = hasFeatureAcuris || hasFeatureDowJones;
  const navigate = useNavigate();

  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    entityType: 'PERSON',
  });

  const hasManualScreeningWritePermission = useHasResources([
    'write:::screening/manual-screening/*',
  ]);

  const searchProfilesResult = useQuery(
    SEARCH_PROFILES({ filterSearchProfileStatus: 'ENABLED' }),
    async () => {
      try {
        const response = await api.getSearchProfiles({
          filterSearchProfileStatus: 'ENABLED',
        });
        return {
          items: response.items || [],
          total: response.items?.length || 0,
        };
      } catch (error) {
        return {
          items: [],
          total: 0,
        };
      }
    },
    {
      enabled: !isScreeningProfileEnabled,
    },
  );

  const screeningProfilesResult = useQuery(
    SCREENING_PROFILES({ filterScreeningProfileStatus: 'ENABLED' }),
    async () => {
      try {
        const response = await api.getScreeningProfiles({
          filterScreeningProfileStatus: 'ENABLED',
        });
        return {
          items: response.items || [],
          total: response.items?.length || 0,
        };
      } catch (error) {
        return {
          items: [],
          total: 0,
        };
      }
    },
    {
      enabled: isScreeningProfileEnabled,
    },
  );

  const defaultManualScreeningFilters = useQuery(
    DEFAULT_MANUAL_SCREENING_FILTERS(),
    async () => {
      return api.getDefaultManualScreeningFilters();
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  );

  useEffect(() => {
    if (hasSetDefaultManualFilters.current) {
      return;
    }
    if (isScreeningProfileEnabled && isSuccess(defaultManualScreeningFilters.data)) {
      const response = getOr(defaultManualScreeningFilters.data, {});
      setParams((prevState) => ({
        ...prevState,
        fuzziness: sanitizeFuzziness(response?.fuzziness ?? prevState?.fuzziness, 'hundred'),
        types: (response?.types ?? prevState?.types) as GenericSanctionsSearchType[],
        nationality: response?.nationality ?? prevState?.nationality,
        yearOfBirthRange:
          response?.yearOfBirthRange?.minYear && response.yearOfBirthRange.maxYear
            ? [
                response.yearOfBirthRange.minYear.toString(),
                response.yearOfBirthRange.maxYear.toString(),
              ]
            : prevState?.yearOfBirthRange,
        documentId: response?.documentId?.[0] ?? prevState?.documentId,
        searchTerm: undefined,
        entityType: response?.entityType ?? prevState?.entityType,
      }));
      hasSetDefaultManualFilters.current = true;
    } else if (isSuccess(searchProfilesResult.data)) {
      const response = getOr(searchProfilesResult.data, { items: [], total: 0 });
      const profiles = response.items || [];
      const defaultProfile = Array.isArray(profiles)
        ? profiles.find((profile) => profile.isDefault) || profiles[0]
        : null;

      if (defaultProfile?.searchProfileId) {
        setParams((current) => ({
          ...current,
          searchProfileId: defaultProfile.searchProfileId,
          ...(defaultProfile.fuzziness
            ? { fuzziness: sanitizeFuzziness(defaultProfile.fuzziness, 'hundred') }
            : {}),
          ...(defaultProfile.types?.length
            ? { types: defaultProfile.types as GenericSanctionsSearchType[] }
            : {}),
          ...(defaultProfile.nationality?.length
            ? { nationality: defaultProfile.nationality }
            : {}),
          searchTerm: undefined,
        }));
      }
      hasSetDefaultManualFilters.current = true;
    }
  }, [searchProfilesResult.data, defaultManualScreeningFilters.data, isScreeningProfileEnabled]);

  useEffect(() => {
    if (
      isScreeningProfileEnabled &&
      !hasSetDefaultProfile.current &&
      isSuccess(screeningProfilesResult.data)
    ) {
      const response = getOr(screeningProfilesResult.data, { items: [], total: 0 });
      const profiles = response.items || [];
      const defaultProfile = profiles.find((profile) => profile.isDefault);

      hasSetDefaultProfile.current = true;

      if (defaultProfile?.screeningProfileId) {
        setParams((current) => ({
          ...current,
          screeningProfileId: defaultProfile.screeningProfileId,
          searchProfileId: undefined,
        }));
      } else if (isScreeningProfileEnabled) {
        setParams((current) => ({
          ...current,
          searchProfileId: undefined,
        }));
      }
    }
  }, [isScreeningProfileEnabled, screeningProfilesResult.data]);

  const historyItemQueryResults = useQuery(
    SANCTIONS_SEARCH_HISTORY(searchId, { page: params.page, pageSize: params.pageSize }),
    () => {
      if (searchId == null) {
        throw new Error(`Unable to get search, searchId is empty!`);
      }
      return api.getSanctionsSearchSearchId({
        searchId: searchId,
        page: params.page,
        pageSize: params.pageSize,
      });
    },
    { enabled: searchId != null },
  );

  const historyItem = getOr(historyItemQueryResults.data, null);

  const onChnageSearchTerm = (inputText?: string) => {
    setParams((params) => ({
      ...params,
      searchTerm: inputText,
    }));
  };

  useEffect(() => {
    if (historyItem) {
      setParams((params) => ({
        ...params,
        searchTerm: historyItem.request?.searchTerm,
        yearOfBirthRange:
          historyItem.request?.yearOfBirthRange?.minYear &&
          historyItem.request.yearOfBirthRange.maxYear
            ? [
                historyItem.request.yearOfBirthRange.minYear.toString(),
                historyItem.request.yearOfBirthRange.maxYear.toString(),
              ]
            : undefined,
        countryCodes: historyItem.request?.countryCodes,
        fuzziness: sanitizeFuzziness(historyItem.request?.fuzziness, 'hundred'),
        nationality: historyItem.request?.nationality,
        occupationCode: historyItem.request?.occupationCode,
        documentId: historyItem.request?.documentId?.[0],
        entityType: historyItem.request?.entityType,
      }));
    }
  }, [historyItem]);

  useEffect(() => {
    if (historyItem?.request?.searchTerm) {
      setSearchTerm(historyItem.request.searchTerm);
    }
  }, [historyItem?.request?.searchTerm, setSearchTerm]);

  const searchEnabled = !!params.searchTerm;

  const selectedSearchProfileResult = useQuery(
    ['selected-search-profile', params.searchProfileId],
    async () => {
      if (!params.searchProfileId) {
        return null;
      }
      const response = await api.getSearchProfiles({
        filterSearchProfileId: [params.searchProfileId],
      });
      return response.items?.[0] || null;
    },
    {
      enabled: !!params.searchProfileId,
    },
  );

  const selectedSearchProfile = getOr(selectedSearchProfileResult.data, null);

  const newSearchMutation = useMutation(
    (searchParams: TableSearchParams) => {
      const searchTerm = searchParams.searchTerm;
      if (!searchTerm) {
        throw new Error('Search term is required');
      }
      return api.postSanctions({
        SanctionsSearchRequest: {
          searchTerm: searchParams.searchTerm ?? '',
          fuzziness: sanitizeFuzziness(
            selectedSearchProfile?.fuzziness ?? searchParams.fuzziness,
            'one',
          ),
          countryCodes: searchParams.countryCodes,
          yearOfBirthRange: searchParams.yearOfBirthRange
            ? {
                minYear: searchParams.yearOfBirthRange[0]
                  ? parseInt(searchParams.yearOfBirthRange[0])
                  : undefined,
                maxYear: searchParams.yearOfBirthRange[1]
                  ? parseInt(searchParams.yearOfBirthRange[1])
                  : undefined,
              }
            : undefined,
          types: selectedSearchProfile?.types ?? searchParams.types,
          nationality: selectedSearchProfile?.nationality ?? searchParams.nationality,
          occupationCode: searchParams.occupationCode,
          documentId: searchParams.documentId ? [searchParams.documentId] : undefined,
          manualSearch: true,
          screeningProfileId: isScreeningProfileEnabled
            ? searchParams.screeningProfileId
            : undefined,
          entityType: searchParams.entityType,
          gender: searchParams.gender,
          countryOfResidence: searchParams.countryOfResidence,
          registrationId: searchParams.registrationId,
        },
      });
    },
    {
      onError: (error) => {
        console.error(error);
        message.error(`Unable to run a search!`, {
          details: getErrorMessage(error),
        });
      },
      onSuccess: (data) => {
        if (data.searchId) {
          navigate(
            makeUrl(`/screening/manual-screening/:searchId`, {
              searchId: data.searchId,
            }),
          );
        }
      },
    },
  );

  const searchDisabled =
    !params.searchTerm ||
    (process.env.ENV_NAME === 'prod' &&
      isSuperAdmin(currentUser) &&
      !currentUser.tenantName.toLowerCase().includes('flagright'));

  const pageSize =
    getOr(
      map(historyItemQueryResults.data, (x) => x?.response?.pageSize),
      null,
    ) ?? DEFAULT_PAGE_SIZE;

  const allParams = useMemo(() => {
    return {
      ...params,
      pageSize,
    };
  }, [params, pageSize]);

  const handleSearch = () => {
    if (!searchId) {
      newSearchMutation.mutate(params);
    } else {
      setParams({
        ...DEFAULT_PARAMS_STATE,
        searchTerm: '',
        entityType: 'PERSON',
      });
      setSearchTerm('');
      hasSetDefaultProfile.current = false;
      hasSetDefaultManualFilters.current = false;
      navigate(makeUrl(`/screening/manual-screening`, {}, {}));
    }
  };

  return (
    <ScreeningHitTable
      readOnly={searchId != null || !hasManualScreeningWritePermission}
      params={allParams}
      onChangeParams={setParams}
      topTools={
        <ScreeningSearchBar
          onChange={onChnageSearchTerm}
          value={params.searchTerm ?? historyItem?.request.searchTerm}
          isSearchDisbled={searchDisabled || isLoading(newSearchMutation.dataResource)}
          searchId={searchId}
          searchFunction={handleSearch}
          requiredResources={['read:::screening/manual-screening/*']}
        />
      }
      queryResult={mapQuery(historyItemQueryResults, (x) => ({
        items: x?.response?.data ?? [],
        total: x?.response?.hitsCount ?? 0,
        pageSize: x?.response?.pageSize ?? DEFAULT_PAGE_SIZE,
      }))}
      searchedAt={
        searchEnabled
          ? Date.now()
          : searchId
          ? historyItem?.updatedAt ?? historyItem?.createdAt
          : undefined
      }
    />
  );
}
