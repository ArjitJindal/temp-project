import { useEffect, useState } from 'react';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { getOr, isLoading, map, success } from '@/utils/asyncResource';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SANCTIONS_SEARCH, SANCTIONS_SEARCH_HISTORY } from '@/utils/queries/keys';
import { LoadingCard } from '@/components/ui/Card';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import Button from '@/components/library/Button';
import SanctionsTable from '@/components/SanctionsTable';
import { SanctionsSearchType } from '@/apis';

function withKey<T>(array?: T[]): T[] {
  return array?.map((item, i) => ({ ...item, key: i })) || [];
}

interface TableSearchParams {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
  types?: Array<SanctionsSearchType>;
}

interface Props {
  searchId?: string;
}

export function SanctionsSearchTable(props: Props) {
  const { searchId } = props;
  const api = useApi();
  usePageViewTracker('Sanctions Search Page');

  const showSearchHistory = Boolean(searchId);
  const searchHistoryQueryResults = useQuery(
    SANCTIONS_SEARCH_HISTORY(searchId),
    () => {
      if (searchId == null) {
        throw new Error(`Unable to get search, searchId is empty!`);
      }
      return measure(
        () => api.getSanctionsSearchSearchId({ searchId: searchId }),
        'Get Sanctions Search History by ID',
      );
    },
    { enabled: showSearchHistory },
  );
  const searchHistoryQueryResponse = map(searchHistoryQueryResults.data, (response) => response);
  const searchHistory = getOr(searchHistoryQueryResponse, null);

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
  useEffect(() => {
    if (searchHistory) {
      setParams((params) => ({
        ...params,
        searchTerm: searchHistory.request?.searchTerm,
        yearOfBirth: searchHistory.request?.yearOfBirth,
        countryCodes: searchHistory.request?.countryCodes,
        fuzziness: searchHistory.request?.fuzziness,
      }));
    }
  }, [searchHistory]);

  const [searchParams, setSearchParams] = useState<AllParams<TableSearchParams>>(params);
  const searchEnabled = !!searchParams.searchTerm;
  const queryResults = useQuery(
    SANCTIONS_SEARCH(searchParams),
    () => {
      return api.postSanctions({
        SanctionsSearchRequest: {
          searchTerm: searchParams.searchTerm ?? '',
          fuzziness: searchParams.fuzziness,
          countryCodes: searchParams.countryCodes,
          yearOfBirth: searchParams.yearOfBirth ? searchParams.yearOfBirth : undefined,
          types: searchParams.types,
        },
      });
    },
    { enabled: searchEnabled },
  );
  const measure = useApiTime();

  return showSearchHistory && isLoading(searchHistoryQueryResponse) ? (
    <LoadingCard />
  ) : (
    <>
      <SanctionsTable
        params={params}
        onChangeParams={setParams}
        extraTools={[
          () => (
            <Button
              isDisabled={!params.searchTerm}
              onClick={() => {
                setSearchParams(params);
              }}
              requiredPermissions={['sanctions:search:read']}
            >
              Search
            </Button>
          ),
        ]}
        queryResult={{
          data: searchEnabled
            ? map(queryResults.data, (response) => ({ items: withKey(response.data) }))
            : searchId
            ? map(searchHistoryQueryResults.data, (response) => ({
                items: withKey(response?.response?.data),
              }))
            : success({ items: [] }),
          refetch: queryResults.refetch,
        }}
      />
    </>
  );
}
