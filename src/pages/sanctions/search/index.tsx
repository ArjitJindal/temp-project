import { useEffect, useState } from 'react';
import { Tag } from 'antd';
import _ from 'lodash';
import { SanctionsSearchResultDetailsModal } from './SearchResultDetailsModal';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { getOr, isLoading, map, success } from '@/utils/asyncResource';
import { AllParams, ExtraFilter, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SANCTIONS_SEARCH, SANCTIONS_SEARCH_HISTORY } from '@/utils/queries/keys';
import COUNTRIES from '@/utils/countries';
import { ComplyAdvantageSearchHit } from '@/apis/models/ComplyAdvantageSearchHit';
import { LoadingCard } from '@/components/ui/Card';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { FLOAT } from '@/components/library/Table/standardDataTypes';
import Button from '@/components/library/Button';

function withKey<T>(array?: T[]): T[] {
  return array?.map((item, i) => ({ ...item, key: i })) || [];
}

type TableSearchParams = {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
};

type Props = {
  searchId?: string;
};

export const SanctionsSearchTable: React.FC<Props> = ({ searchId }) => {
  const api = useApi();
  usePageViewTracker('Sanctions Search Page');

  const showSearchHistory = Boolean(searchId);
  const searchHistoryQueryResults = useQuery(
    SANCTIONS_SEARCH_HISTORY(searchId),
    () => {
      return measure(
        () => api.getSanctionsSearchSearchId({ searchId: searchId! }),
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

  const [selectedSearchHit, setSelectedSearchHit] = useState<ComplyAdvantageSearchHit>();
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
        },
      });
    },
    { enabled: searchEnabled },
  );
  const measure = useApiTime();

  const helper = new ColumnHelper<ComplyAdvantageSearchHit>();
  const columns: TableColumn<ComplyAdvantageSearchHit>[] = helper.list([
    // Data fields
    helper.simple<'doc.entity_type'>({
      title: 'Type',
      key: 'doc.entity_type',
      type: {
        render: (value) => <Tag>{_.startCase(value)}</Tag>,
      },
    }),
    helper.simple<'doc.name'>({
      title: 'Name',
      key: 'doc.name',
      type: {
        render: (name, _edit, entity) => (
          <div>{<a onClick={() => setSelectedSearchHit(entity)}>{name}</a>}</div>
        ),
      },
    }),
    helper.derived<string>({
      title: 'Countries',
      value: (item: ComplyAdvantageSearchHit): string | undefined => {
        return item?.doc?.fields?.find((field) => field.name === 'Countries')?.value;
      },
      type: {
        render: (countryNames, _edit) => (
          <>
            {countryNames?.split(/,\s*/)?.map((countryName) => (
              <CountryDisplay key={countryName} countryName={countryName} />
            ))}
          </>
        ),
      },
    }),
    helper.derived<string[]>({
      title: 'Matched Types',
      value: (entity: ComplyAdvantageSearchHit) => {
        return entity.doc?.types;
      },
      type: {
        render: (types) => {
          return (
            <>
              {types?.map((matchType) => (
                <Tag key={matchType} color="volcano">
                  {_.startCase(matchType)}
                </Tag>
              ))}
            </>
          );
        },
      },
    }),
    helper.derived<string[]>({
      title: 'Relevance',
      value: (entity: ComplyAdvantageSearchHit) => {
        return entity.doc?.types;
      },
      type: {
        render: (match_types) => {
          return (
            <>
              {match_types?.map((matchType) => (
                <Tag key={matchType}>{_.startCase(matchType)}</Tag>
              ))}
            </>
          );
        },
      },
    }),
    helper.simple<'score'>({
      key: 'score',
      title: 'Score',
      type: FLOAT,
    }),
  ]);

  const extraFilters: ExtraFilter<TableSearchParams>[] = [
    {
      title: 'Search Term',
      key: 'searchTerm',
      renderer: {
        kind: 'string',
      },
    },
    {
      title: 'Year of Birth',
      key: 'yearOfBirth',
      renderer: {
        kind: 'number',
        min: 1900,
      },
    },
    {
      title: 'Country Codes',
      key: 'countryCodes',
      renderer: {
        kind: 'select',
        options: Object.entries(COUNTRIES).map((entry) => ({ value: entry[0], label: entry[1] })),
        mode: 'MULTIPLE',
        displayMode: 'select',
      },
    },
    {
      title: 'Fuzziness',
      key: 'fuzziness',
      renderer: {
        kind: 'number',
        min: 0,
        max: 1,
        step: 0.1,
      },
    },
  ];

  return showSearchHistory && isLoading(searchHistoryQueryResponse) ? (
    <LoadingCard />
  ) : (
    <>
      <QueryResultsTable<ComplyAdvantageSearchHit, TableSearchParams>
        tableId="sanctions-search-results"
        extraTools={[
          () => (
            <Button
              isDisabled={!params.searchTerm}
              onClick={() => {
                setSearchParams(params);
              }}
            >
              Search
            </Button>
          ),
        ]}
        extraFilters={extraFilters}
        queryResults={{
          data: searchEnabled
            ? map(queryResults.data, (response) => ({ items: withKey(response.data) }))
            : searchId
            ? map(searchHistoryQueryResults.data, (response) => ({
                items: withKey(response?.response?.data),
              }))
            : success({ items: [] }),
          refetch: queryResults.refetch,
        }}
        params={params}
        onChangeParams={setParams}
        rowKey="key"
        columns={columns}
        pagination={false}
        toolsOptions={{
          reload: false,
        }}
      />
      {selectedSearchHit && (
        <SanctionsSearchResultDetailsModal
          hit={selectedSearchHit}
          onClose={() => setSelectedSearchHit(undefined)}
        />
      )}
    </>
  );
};
