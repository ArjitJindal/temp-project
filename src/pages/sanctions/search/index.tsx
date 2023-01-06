import { useState } from 'react';
import { Tag } from 'antd';
import _ from 'lodash';
import { SanctionsSearchResultDetailsModal } from './SearchResultDetailsModal';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { map, Success, success } from '@/utils/asyncResource';
import { TableColumn } from '@/components/ui/Table/types';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { SANCTIONS_SEARCH, SANCTIONS_SEARCH_HISTORY } from '@/utils/queries/keys';
import COUNTRIES from '@/utils/countries';
import { ComplyAdvantageSearchHit } from '@/apis/models/ComplyAdvantageSearchHit';
import { SanctionsSearchHistory } from '@/apis/models/SanctionsSearchHistory';
import { LoadingCard } from '@/components/ui/Card';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';

function withKey<T>(array?: T[]): T[] {
  return array?.map((item, i) => ({ ...item, key: i })) || [];
}

type TableSearchParams = {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: string;
};

type Props = {
  searchId?: string;
};

export const SanctionsSearchTable: React.FC<Props> = ({ searchId }) => {
  const api = useApi();
  usePageViewTracker('Sanctions Search Page');
  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
  const [selectedSearchHit, setSelectedSearchHit] = useState<ComplyAdvantageSearchHit>();
  const searchEnabled = !!params.searchTerm;
  const queryResults = useQuery(
    SANCTIONS_SEARCH(params),
    () => {
      return api.postSanctions({
        SanctionsSearchRequest: {
          searchTerm: params.searchTerm as string,
          fuzziness: params.fuzziness,
          countryCodes: params.countryCodes,
          yearOfBirth: params.yearOfBirth ? parseInt(params.yearOfBirth) : undefined,
        },
      });
    },
    { enabled: searchEnabled },
  );
  const showSearchHistory = Boolean(searchId);
  const measure = useApiTime();
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
  const serachHistoryQueryResponse = map(searchHistoryQueryResults.data, (response) => response);
  const searchHistory = (serachHistoryQueryResponse as Success<SanctionsSearchHistory>).value;

  const columns: TableColumn<ComplyAdvantageSearchHit>[] = [
    // Search fields
    {
      title: 'Search Term',
      dataIndex: 'searchTerm',
      initialValue: showSearchHistory ? searchHistory?.request?.searchTerm : undefined,
      hideInTable: true,
    },
    {
      title: 'Year of Birth',
      dataIndex: 'yearOfBirth',
      valueType: 'dateYear',
      initialValue: showSearchHistory ? searchHistory?.request?.yearOfBirth : undefined,
      hideInTable: true,
    },
    {
      title: 'Country Codes',
      dataIndex: 'countryCodes',
      valueType: 'select',
      fieldProps: {
        options: Object.entries(COUNTRIES).map((entry) => ({ value: entry[0], label: entry[1] })),
        allowClear: true,
        mode: 'multiple',
      },
      initialValue: showSearchHistory ? searchHistory?.request?.countryCodes : undefined,
      hideInTable: true,
    },
    {
      title: 'Fuzziness',
      dataIndex: 'fuzziness',
      valueType: 'digit',
      initialValue: showSearchHistory ? searchHistory?.request?.fuzziness : undefined,
      hideInTable: true,
    },
    // Data fields
    {
      title: 'Type',
      width: 25,
      search: false,
      render: (_dom, entity) => <Tag>{_.startCase(entity.doc?.entity_type)}</Tag>,
    },
    {
      title: 'Name',
      width: 100,
      search: false,
      render: (_, entity) => (
        <div>{<a onClick={() => setSelectedSearchHit(entity)}>{entity.doc?.name}</a>}</div>
      ),
    },
    {
      title: 'Countries',
      width: 50,
      search: false,
      render: (_, entity) => {
        const countryNames = entity.doc?.fields?.find((field) => field.name === 'Countries')?.value;
        return countryNames
          ?.split(/,\s*/)
          ?.map((countryName) => <CountryDisplay key={countryName} countryName={countryName} />);
      },
    },
    {
      title: 'Matched Types',
      width: 50,
      search: false,
      render: (_dom, entity) => {
        return (
          <>
            {entity.doc?.types?.map((matchType) => (
              <Tag key={matchType} color="volcano">
                {_.startCase(matchType)}
              </Tag>
            ))}
          </>
        );
      },
    },
    {
      title: 'Relevance',
      width: 50,
      search: false,
      render: (_dom, entity) => {
        return (
          <>
            {entity.match_types?.map((matchType) => (
              <Tag key={matchType}>{_.startCase(matchType)}</Tag>
            ))}
          </>
        );
      },
    },
    {
      title: 'Score',
      width: 50,
      search: false,
      render: (_dom, entity) => {
        return _.round(entity.score!, 2);
      },
    },
  ];

  return showSearchHistory && serachHistoryQueryResponse.kind === 'LOADING' ? (
    <LoadingCard />
  ) : (
    <>
      <QueryResultsTable
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
        search={{
          labelWidth: 120,
        }}
        options={{
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
