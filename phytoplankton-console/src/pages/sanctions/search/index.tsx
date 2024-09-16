import { useEffect, useMemo, useState } from 'react';
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
import { SANCTIONS_SEARCH, SANCTIONS_SEARCH_HISTORY } from '@/utils/queries/keys';
import Button from '@/components/library/Button';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import { QueryResult } from '@/utils/queries/types';
import { notEmpty } from '@/utils/array';

interface TableSearchParams {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
  types?: Array<SanctionsSearchType>;
  nationality?: Array<string>;
  occupationCode?: Array<OccupationCode>;
  documentId?: string;
}

interface Props {
  searchId?: string;
}

export function SearchResultTable(props: Props) {
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

  const historyItem = getOr(historyItemQueryResults.data, null);

  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
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
        documentId: historyItem.request?.documentId,
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
          nationality: searchParams.nationality,
          occupationCode: searchParams.occupationCode,
          documentId: searchParams.documentId,
        },
      });
    },
    {
      enabled: searchEnabled,
      onSuccess: (data) => {
        if (data.searchId) {
          navigate(
            makeUrl(
              `/screening/search/:searchId`,
              {
                searchId: data.searchId,
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
    if (isSuccess(newSearchQueryResults.data)) {
      items = newSearchQueryResults.data.value.data;
      refetch = newSearchQueryResults.refetch;
    } else if (isSuccess(historyItemQueryResults.data)) {
      items = historyItemQueryResults.data.value.response?.data;
      refetch = historyItemQueryResults.refetch;
    }
    const dataRes: AsyncResource<TableData<SanctionsEntity>> =
      items != null
        ? success({
            total: items.length,
            items: items,
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
      map(newQueryResult.data, (x) => x.total),
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
                navigate(makeUrl(`/sanctions/search`, {}, {}));
                setParams(DEFAULT_PARAMS_STATE);
                setSearchParams(DEFAULT_PARAMS_STATE);
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
