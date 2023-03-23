import { useState } from 'react';
import _ from 'lodash';
import { RangeValue } from 'rc-picker/es/interface';
import { useTableData } from '@/utils/table-utils';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { TableColumn } from '@/components/ui/Table/types';
import { AllParams, CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { SANCTIONS_SEARCH } from '@/utils/queries/keys';
import { SanctionsSearchHistory } from '@/apis/models/SanctionsSearchHistory';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import Id from '@/components/ui/Id';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { Dayjs, dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';

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

  const tableQueryResult = useTableData<SanctionsSearchHistory>(queryResults);

  const columns: TableColumn<SanctionsSearchHistory>[] = [
    // Data fields
    {
      title: 'Created',
      dataIndex: 'createdAt',
      width: 25,
      search: false,
      hideInSearch: true,
      render: (_dom, entity) => <TimestampDisplay timestamp={entity.createdAt} />,
      exportData: (entity) => dayjs(entity.createdAt).format(DEFAULT_DATE_TIME_FORMAT),
    },
    {
      title: 'Search Term',
      dataIndex: 'request.searchTerm',
      width: 100,
      search: false,
      hideInSearch: true,
      render: (_, entity) => (
        <Id id={entity.request._id} to={`/sanctions/search/${entity.request._id}`}>
          {entity.request.searchTerm}
        </Id>
      ),
      exportData: 'request.searchTerm',
    },
  ];

  return (
    <>
      <QueryResultsTable
        queryResults={tableQueryResult}
        params={params}
        onChangeParams={setParams}
        rowKey="createdAt"
        columns={columns}
        search={false}
        autoAdjustHeight
        toolBarRender={() => [
          <DatePicker.RangePicker
            value={params.createdTimestamp}
            onChange={(createdTimestamp) =>
              setParams((prevState) => ({ ...prevState, createdTimestamp }))
            }
          />,
        ]}
      />
    </>
  );
};
