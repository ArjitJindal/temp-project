import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { humanizeCamelCase } from '@flagright/lib/utils/humanize';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams, CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SanctionsSearchHistoryItem } from '@/apis/models/SanctionsSearchHistoryItem';
import Id from '@/components/ui/Id';
import { Dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import AccountTag from '@/components/AccountTag';
import { AccountsFilter } from '@/components/library/AccountsFilter';
import { GenericSanctionsSearchType } from '@/apis';
import { GENERIC_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/GenericSanctionsSearchType';
import { useSanctionsSearch } from '@/utils/api/screening';

type TableSearchParams = CommonParams & {
  searchTerm?: string;
  types?: GenericSanctionsSearchType[];
  createdAt?: RangeValue<Dayjs>;
  searchedBy?: string[];
};

const sanctionsSearchLink = (searchId: string) => `/screening/manual-screening/${searchId}`;

export const SanctionsSearchHistoryTable: React.FC = () => {
  const [params, setParams] = useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);

  const handleChangeParams = (newParams: AllParams<TableSearchParams>) => {
    setParams((prev) => ({
      ...prev,
      ...newParams,
      start: newParams.from,
    }));
  };

  const queryResults = useSanctionsSearch(params);

  const helper = new ColumnHelper<SanctionsSearchHistoryItem & { rowKey: string }>();
  const columns: TableColumn<SanctionsSearchHistoryItem & { rowKey: string }>[] = [
    helper.simple<'screeningType'>({
      title: 'Type',
      key: 'screeningType',
      type: {
        render: (value) => <>{value === 'BATCH' ? 'Batch screening' : 'Search'}</>,
        stringify: (value) => (value === 'BATCH' ? 'Batch screening' : 'Search'),
      },
    }),
    helper.simple<'request.searchTerm'>({
      title: 'Search term',
      key: 'request.searchTerm',
      type: {
        render: (searchTerm, { item }) =>
          item.screeningType === 'BATCH' && item.searchTermId ? (
            <Id to={`/screening/bulk-search/${item.searchTermId}`}>{searchTerm}</Id>
          ) : (
            <Id to={sanctionsSearchLink(item._id)}>{searchTerm}</Id>
          ),
        stringify: (_, item) => item.request.searchTerm,
        link: (_, item) =>
          item.screeningType === 'BATCH' && item.searchTermId
            ? `/screening/bulk-search/${item.searchTermId}`
            : sanctionsSearchLink(item._id),
      },
    }),
    helper.derived({
      title: 'Import ID',
      value: (item): unknown => item.searchTermId,
      type: {
        render: (value, { item }) => (
          <>
            {item.screeningType === 'BATCH' && value ? (
              <Id to={`/screening/bulk-search/${String(value)}`}>{String(value)}</Id>
            ) : (
              '-'
            )}
          </>
        ),
        stringify: (value, item) => (item.screeningType === 'BATCH' ? String(value ?? '-') : '-'),
        link: (value, item) =>
          item.screeningType === 'BATCH' && value
            ? `/screening/bulk-search/${String(value)}`
            : undefined,
      },
    }),
    helper.simple<'createdAt'>({
      title: 'Created at',
      key: 'createdAt',
      type: DATE_TIME,
      filtering: false,
    }),
    helper.simple<'searchedBy'>({
      title: 'By',
      key: 'searchedBy',
      type: {
        render: (userId) => (
          <div style={{ overflowWrap: 'anywhere' }}>
            <AccountTag accountId={userId} />
          </div>
        ),
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
        options: GENERIC_SANCTIONS_SEARCH_TYPES.map((value) => ({
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
        rowKey="rowKey"
        queryResults={queryResults}
        params={params}
        onChangeParams={handleChangeParams}
        sizingMode="FULL_WIDTH"
        columns={columns}
        fitHeight
        pagination
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
