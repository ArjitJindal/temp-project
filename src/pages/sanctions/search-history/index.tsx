import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SANCTIONS_SEARCH } from '@/utils/queries/keys';
import { SanctionsSearchHistory } from '@/apis/models/SanctionsSearchHistory';
import Id from '@/components/ui/Id';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';

type TableSearchParams = CommonParams & {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
  createdTimestamp: RangeValue<Dayjs>;
};

export const SanctionsSearchHistoryTable: React.FC = () => {
  usePageViewTracker('Sanctions Search History Page');
  const api = useApi();
  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    createdTimestamp: [dayjs().subtract(7, 'day'), dayjs()],
    pagination: false,
  });

  const measure = useApiTime();

  const queryResults = usePaginatedQuery<SanctionsSearchHistory>(
    SANCTIONS_SEARCH(params),
    async (paginationParams) => {
      const { createdTimestamp, ...rest } = params;
      const [start, end] = createdTimestamp ?? [];
      const response = await measure(
        () =>
          api.getSanctionsSearch({
            ...rest,
            afterTimestamp: start ? start.startOf('day').valueOf() : 0,
            beforeTimestamp: end ? end.endOf('day').valueOf() : Number.MAX_SAFE_INTEGER,
            ...paginationParams,
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
          <Id id={entity.request._id} to={`/sanctions/search/${entity._id}`}>
            {searchTerm}
          </Id>
        ),
      },
    }),
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
        extraTools={[
          () => (
            <DatePicker.RangePicker
              value={params.createdTimestamp}
              onChange={(createdTimestamp) =>
                setParams((prevState) => ({ ...prevState, createdTimestamp }))
              }
            />
          ),
        ]}
      />
    </>
  );
};
