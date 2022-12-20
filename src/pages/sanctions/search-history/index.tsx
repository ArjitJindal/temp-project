import { useState } from 'react';
import _ from 'lodash';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { map } from '@/utils/asyncResource';
import { TableColumn } from '@/components/ui/Table/types';
import { AllParams, CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { SANCTIONS_SEARCH } from '@/utils/queries/keys';
import { SanctionsSearchHistory } from '@/apis/models/SanctionsSearchHistory';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import Id from '@/components/ui/Id';

type TableSearchParams = CommonParams & {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
};

export const SanctionsSearchHistoryTable: React.FC = () => {
  const api = useApi();
  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
  const queryResults = useQuery(SANCTIONS_SEARCH(params), () => {
    return api.getSanctionsSearch({
      ...params,
    });
  });

  const columns: TableColumn<SanctionsSearchHistory>[] = [
    // Data fields
    {
      title: 'Created',
      width: 25,
      search: false,
      render: (_dom, entity) => <TimestampDisplay timestamp={entity.createdAt} />,
    },
    {
      title: 'Search Term',
      width: 100,
      search: false,
      render: (_, entity) => (
        <Id id={entity.request._id} to={`/sanctions/search/${entity.request._id}`}>
          {entity.request.searchTerm}
        </Id>
      ),
    },
  ];

  return (
    <>
      <QueryResultsTable
        queryResults={{
          data: map(queryResults.data, (response) => ({ items: response })),
          refetch: queryResults.refetch,
        }}
        params={params}
        onChangeParams={setParams}
        rowKey="createdAt"
        columns={columns}
        search={false}
      />
    </>
  );
};
