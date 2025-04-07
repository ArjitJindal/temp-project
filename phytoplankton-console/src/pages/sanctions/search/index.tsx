import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ComplyAdvantageHitTable from 'src/components/ComplyAdvantageHitTable';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { OccupationCode, SanctionsEntity, SanctionsSearchType } from '@/apis';
import {
  AsyncResource,
  getOr,
  init,
  isLoading,
  isSuccess,
  loading,
  map,
  success,
} from '@/utils/asyncResource';
import { AllParams, TableData } from '@/components/library/Table/types';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SANCTIONS_SEARCH, SANCTIONS_SEARCH_HISTORY, SEARCH_PROFILES } from '@/utils/queries/keys';
import Button from '@/components/library/Button';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import { QueryResult } from '@/utils/queries/types';
import { notEmpty } from '@/utils/array';
import { message } from '@/components/library/Message';

interface TableSearchParams {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
  types?: Array<SanctionsSearchType>;
  nationality?: Array<string>;
  occupationCode?: Array<OccupationCode>;
  documentId?: string;
  searchProfileId?: string;
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

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);

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
  );

  useEffect(() => {
    const response = getOr(searchProfilesResult.data, { items: [], total: 0 });
    const profiles = response.items || [];
    const defaultProfile = Array.isArray(profiles)
      ? profiles.find((profile) => profile.isDefault) || profiles[0]
      : null;

    if (defaultProfile?.searchProfileId && !hasSetDefaultProfile.current) {
      setParams((current) => ({
        ...current,
        searchProfileId: defaultProfile.searchProfileId,
        ...(defaultProfile.fuzziness ? { fuzziness: defaultProfile.fuzziness } : {}),
        ...(defaultProfile.types?.length
          ? { types: defaultProfile.types as SanctionsSearchType[] }
          : {}),
        ...(defaultProfile.nationality?.length ? { nationality: defaultProfile.nationality } : {}),
      }));
      setSearchParams((current) => ({
        ...current,
        searchProfileId: defaultProfile.searchProfileId,
        ...(defaultProfile.fuzziness ? { fuzziness: defaultProfile.fuzziness } : {}),
        ...(defaultProfile.types?.length
          ? { types: defaultProfile.types as SanctionsSearchType[] }
          : {}),
        ...(defaultProfile.nationality?.length ? { nationality: defaultProfile.nationality } : {}),
      }));
      hasSetDefaultProfile.current = true;
    }
  }, [searchProfilesResult.data]);

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

  useEffect(() => {
    if (historyItem) {
      setParams((params) => ({
        ...params,
        searchTerm: historyItem.request?.searchTerm,
        yearOfBirth: historyItem.request?.yearOfBirth,
        countryCodes: historyItem.request?.countryCodes,
        fuzziness: historyItem.request?.fuzziness,
        nationality: historyItem.request?.nationality,
        occupationCode: historyItem.request?.occupationCode,
        documentId: historyItem.request?.documentId?.[0],
      }));
    }
  }, [historyItem]);

  useEffect(() => {
    if (historyItem?.request?.searchTerm) {
      setSearchTerm(historyItem.request.searchTerm);
    }
  }, [historyItem?.request?.searchTerm, setSearchTerm]);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState<AllParams<TableSearchParams>>(params);
  const searchEnabled = !!searchParams.searchTerm;

  const selectedSearchProfileResult = useQuery(
    ['selected-search-profile', searchParams.searchProfileId],
    async () => {
      if (!searchParams.searchProfileId) {
        return null;
      }
      const response = await api.getSearchProfiles({
        filterSearchProfileId: [searchParams.searchProfileId],
      });
      return response.items?.[0] || null;
    },
    {
      enabled: !!searchParams.searchProfileId,
    },
  );

  const selectedSearchProfile = getOr(selectedSearchProfileResult.data, null);

  const newSearchQueryResults = useQuery(
    SANCTIONS_SEARCH({
      ...searchParams,
      pageSize: params.pageSize,
      page: params.page,
    }),
    () => {
      return api.postSanctions({
        SanctionsSearchRequest: {
          searchTerm: searchParams.searchTerm ?? '',
          fuzziness: selectedSearchProfile?.fuzziness ?? searchParams.fuzziness,
          countryCodes: searchParams.countryCodes,
          yearOfBirth: searchParams.yearOfBirth ? searchParams.yearOfBirth : undefined,
          types: selectedSearchProfile?.types ?? searchParams.types,
          nationality: selectedSearchProfile?.nationality ?? searchParams.nationality,
          occupationCode: searchParams.occupationCode,
          documentId: searchParams.documentId ? [searchParams.documentId] : undefined,
          manualSearch: true,
        },
      });
    },
    {
      enabled: searchEnabled,
      onSuccess: (data) => {
        if (data.searchId) {
          navigate(
            makeUrl(
              `/screening/manual-screening/:searchId`,
              {
                searchId: data.searchId,
                page: params.page,
                pageSize: params.pageSize,
              },
              {},
            ),
          );
        }
      },
    },
  );

  const searchDisabled =
    !params.searchTerm ||
    // NOTE: In prod, only customer users can manually search for sanctions
    (process.env.ENV_NAME === 'prod' &&
      isSuperAdmin(currentUser) &&
      !currentUser.tenantName.toLowerCase().includes('flagright'));

  const newQueryResult: QueryResult<TableData<SanctionsEntity>> = useMemo(() => {
    let items;
    let refetch;
    let count;
    let pageSize;
    if (isSuccess(historyItemQueryResults.data)) {
      if (!historyItemQueryResults.data.value) {
        message.error('No search results found for this search id');
      }
      items = historyItemQueryResults.data.value?.response?.data;
      count = historyItemQueryResults.data.value?.response?.hitsCount;
      pageSize = historyItemQueryResults.data.value?.response?.pageSize;
      refetch = historyItemQueryResults.refetch;
    }
    const dataRes: AsyncResource<TableData<SanctionsEntity>> =
      items != null
        ? success({
            total: count,
            items: items,
            pageSize: pageSize,
          })
        : isLoading(newSearchQueryResults.data) || isLoading(historyItemQueryResults.data)
        ? loading()
        : init();
    return {
      data: dataRes,
      refetch: refetch ?? (() => {}),
    };
  }, [historyItemQueryResults, newSearchQueryResults]);

  const pageSize =
    getOr(
      map(newQueryResult.data, (x) => x.pageSize),
      null,
    ) ?? DEFAULT_PAGE_SIZE;

  const allParams = useMemo(() => {
    return {
      ...params,
      pageSize,
    };
  }, [params, pageSize]);

  return (
    <ComplyAdvantageHitTable
      readOnly={searchId != null}
      params={allParams}
      onChangeParams={setParams}
      extraTools={[
        searchId == null &&
          (() => (
            <Button
              isDisabled={searchDisabled}
              onClick={() => {
                setSearchParams(params);
              }}
              requiredPermissions={['sanctions:search:read']}
            >
              Search
            </Button>
          )),
        searchId != null &&
          (() => (
            <Button
              onClick={() => {
                navigate(makeUrl(`/screening/manual-screening`, {}, {}));
                setParams(DEFAULT_PARAMS_STATE);
                setSearchParams(DEFAULT_PARAMS_STATE);
                setSearchTerm('');
              }}
              requiredPermissions={['sanctions:search:read']}
            >
              New search
            </Button>
          )),
      ].filter(notEmpty)}
      queryResult={newQueryResult}
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
