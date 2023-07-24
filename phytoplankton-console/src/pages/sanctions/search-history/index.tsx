import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import {
  AllParams,
  CommonParams,
  ExtraFilter,
  TableColumn,
} from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SANCTIONS_SEARCH } from '@/utils/queries/keys';
import { SanctionsSearchHistory } from '@/apis/models/SanctionsSearchHistory';
import Id from '@/components/ui/Id';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { Dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import { SanctionsSearchType } from '@/apis';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';
import { humanizeCamelCase } from '@/utils/humanize';

type TableSearchParams = CommonParams & {
  searchTerm?: string;
  types?: SanctionsSearchType[];
  createdAt?: RangeValue<Dayjs>;
};

export const SanctionsSearchHistoryTable: React.FC = () => {
  usePageViewTracker('Sanctions Search History Page');
  const api = useApi();
  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);

  const measure = useApiTime();

  const queryResults = usePaginatedQuery<SanctionsSearchHistory>(
    SANCTIONS_SEARCH(params),
    async () => {
      const { createdAt, searchTerm, types, ...rest } = params;
      const [start, end] = createdAt ?? [];
      const response = await measure(
        () =>
          api.getSanctionsSearch({
            afterTimestamp: start ? start.startOf('day').valueOf() : 0,
            beforeTimestamp: end ? end.endOf('day').valueOf() : Number.MAX_SAFE_INTEGER,
            searchTerm,
            types,
            ...rest,
          }),
        'Get Sanctions Search',
      );

      return {
        total: response?.total || 0,
        items: response?.items || [],
      };
    },
  );

  const helper = new ColumnHelper<SanctionsSearchHistory>();
  const columns: TableColumn<SanctionsSearchHistory>[] = [
    // Data fields
    helper.simple<'createdAt'>({
      title: 'Created',
      key: 'createdAt',
      type: DATE_TIME,
    }),
    helper.simple<'request.searchTerm'>({
      title: 'Search Term',
      key: 'request.searchTerm',
      type: {
        render: (searchTerm, { item: entity }) => (
          <Id to={`/sanctions/search/${entity._id}`}>{searchTerm}</Id>
        ),
      },
    }),
  ];
  const extraFilters: ExtraFilter<TableSearchParams>[] = [
    {
      title: 'Search Term',
      key: 'searchTerm',
      renderer: {
        kind: 'string',
      },
    },
    {
      title: 'Match Types',
      key: 'types',
      renderer: {
        kind: 'select',
        options: SANCTIONS_SEARCH_TYPES.map((value) => ({
          label: humanizeCamelCase(value),
          value,
        })),
        mode: 'MULTIPLE',
        displayMode: 'select',
      },
    },
  ];

  return (
    <>
      <QueryResultsTable
        rowKey="createdAt"
        queryResults={queryResults}
        params={params}
        onChangeParams={setParams}
        columns={columns}
        fitHeight
        pagination={true}
        extraFilters={extraFilters}
        extraTools={[
          () => (
            <DatePicker.RangePicker
              value={params.createdAt}
              onChange={(createdAt) => setParams((prevState) => ({ ...prevState, createdAt }))}
            />
          ),
        ]}
      />
    </>
  );
};
