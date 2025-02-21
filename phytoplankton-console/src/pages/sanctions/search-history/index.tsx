import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { humanizeCamelCase } from '@flagright/lib/utils/humanize';
import { useCursorQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams, CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SANCTIONS_SEARCH } from '@/utils/queries/keys';
import { SanctionsSearchHistory } from '@/apis/models/SanctionsSearchHistory';
import Id from '@/components/ui/Id';
import { Dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import { SanctionsSearchType } from '@/apis';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import AccountTag from '@/components/AccountTag';
import { AccountsFilter } from '@/components/library/AccountsFilter';

type TableSearchParams = CommonParams & {
  searchTerm?: string;
  types?: SanctionsSearchType[];
  createdAt?: RangeValue<Dayjs>;
  searchedBy?: string[];
};

const sanctionsSearchLink = (searchId: string) => `/screening/manual-screening/${searchId}`;

export const SanctionsSearchHistoryTable: React.FC = () => {
  const api = useApi();
  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);

  const queryResults = useCursorQuery<SanctionsSearchHistory>(
    SANCTIONS_SEARCH(params),
    async ({ from }) => {
      const { createdAt, searchTerm, types, searchedBy, ...rest } = params;
      const [start, end] = createdAt ?? [];
      const response = await api.getSanctionsSearch({
        afterTimestamp: start ? start.startOf('day').valueOf() : 0,
        beforeTimestamp: end ? end.endOf('day').valueOf() : Number.MAX_SAFE_INTEGER,
        searchTerm,
        types,
        start: from,
        filterSearchedBy: searchedBy,
        filterManualSearch: true,
        ...rest,
      });

      return response;
    },
  );

  const helper = new ColumnHelper<SanctionsSearchHistory>();
  const columns: TableColumn<SanctionsSearchHistory>[] = [
    // Data fields
    helper.simple<'createdAt'>({
      title: 'Created',
      key: 'createdAt',
      type: DATE_TIME,
      // NOTE: No filtering here. Time filter is handled by the extra tools.
      filtering: false,
    }),
    helper.simple<'request.searchTerm'>({
      title: 'Search term',
      key: 'request.searchTerm',
      type: {
        render: (searchTerm, { item: entity }) => (
          <Id to={sanctionsSearchLink(entity._id)}>{searchTerm}</Id>
        ),
        stringify(value, item) {
          return item.request.searchTerm;
        },
        link: (value, item) => sanctionsSearchLink(item._id),
      },
    }),
    helper.simple<'searchedBy'>({
      title: 'Searched by',
      key: 'searchedBy',
      type: {
        render: (userId) => {
          return (
            <div style={{ overflowWrap: 'anywhere' }}>
              <AccountTag accountId={userId} />
            </div>
          );
        },
      },
    }),
  ];
  const extraFilters: ExtraFilterProps<TableSearchParams>[] = [
    {
      title: 'Search term',
      key: 'searchTerm',
      renderer: {
        kind: 'string',
      },
    },
    {
      title: 'Match types',
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
    {
      title: 'Searched by',
      key: 'searchedBy',
      renderer: ({ params, setParams }) => (
        <AccountsFilter
          users={params.searchedBy ?? []}
          onConfirm={(value) => {
            setParams((prevState) => ({
              ...prevState,
              searchedBy: value,
            }));
          }}
          title="Searched by"
        />
      ),
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
