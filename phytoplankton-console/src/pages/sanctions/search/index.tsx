import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { SanctionsHit, SanctionsSearchType } from '@/apis';
import { getOr, map, isLoading, loading } from '@/utils/asyncResource';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  SANCTIONS_SEARCH,
  SANCTIONS_SEARCH_HISTORY,
  SANCTIONS_HITS_SEARCH,
} from '@/utils/queries/keys';
import Button from '@/components/library/Button';
import SanctionsTable from '@/components/SanctionsTable';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';

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
  const currentUser = useAuth0User();

  const historyItemQueryResults = useQuery(
    SANCTIONS_SEARCH_HISTORY(searchId),
    () => {
      if (searchId == null) {
        throw new Error(`Unable to get search, searchId is empty!`);
      }
      return api.getSanctionsSearchSearchId({ searchId: searchId });
    },
    { enabled: searchId != null },
  );

  const historyItem = getOr(
    map(historyItemQueryResults.data, (response) => response),
    null,
  );

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
  useEffect(() => {
    if (historyItem) {
      setParams((params) => ({
        ...params,
        searchTerm: historyItem.request?.searchTerm,
        yearOfBirth: historyItem.request?.yearOfBirth,
        countryCodes: historyItem.request?.countryCodes,
        fuzziness: historyItem.request?.fuzziness,
      }));
    }
  }, [historyItem]);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState<AllParams<TableSearchParams>>(params);
  const searchEnabled = !!searchParams.searchTerm;
  const newSearchQueryResults = useQuery(
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
    {
      enabled: searchEnabled,
      onSuccess: (data) => {
        navigate(
          makeUrl(
            `/sanctions/search/:searchId`,
            {
              searchId: data.searchId,
            },
            {},
          ),
        );
      },
    },
  );
  const searchDisabled =
    !params.searchTerm ||
    // NOTE: In prod, only customer users can manually search for sanctions
    (process.env.ENV_NAME === 'prod' &&
      isSuperAdmin(currentUser) &&
      !currentUser.tenantName.toLowerCase().includes('flagright'));

  const searchIdToUse =
    getOr(
      map(newSearchQueryResults.data, (x) => x.searchId),
      null,
    ) ?? searchId;

  const hitsQueryResults = useQuery(
    SANCTIONS_HITS_SEARCH({ filterSearchId: searchIdToUse }),
    () => {
      if (searchIdToUse == null) {
        throw new Error(`Unable to get search, searchId is empty!`);
      }
      return api.searchSanctionsHits({
        filterSearchId: [searchIdToUse],
      });
    },
    { enabled: searchIdToUse != null },
  );

  return (
    <SanctionsTable
      params={params}
      onChangeParams={setParams}
      extraTools={[
        () => (
          <Button
            isDisabled={searchDisabled}
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
        data:
          isLoading(historyItemQueryResults.data) || isLoading(newSearchQueryResults.data)
            ? loading<{ items: SanctionsHit[] }>(null)
            : hitsQueryResults.data,
        refetch: hitsQueryResults.refetch,
      }}
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
