import React, { useEffect, useMemo, useState } from 'react';
import { startCase } from 'lodash';
import { COUNTRIES } from '@flagright/lib/constants';
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import { useSettings } from '../AppWrapper/Providers/SettingsProvider';
import SearchResultDetailsDrawer from './SearchResultDetailsDrawer';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  AllParams,
  isSingleRow,
  SelectionAction,
  TableColumn,
  TableData,
  TableDataItem,
  TableRefType,
  ToolRenderer,
} from '@/components/library/Table/types';
import { SanctionsHit } from '@/apis/models/SanctionsHit';
import { SanctionsHitStatus } from '@/apis/models/SanctionsHitStatus';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { QueryResult } from '@/utils/queries/types';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import Tag from '@/components/library/Tag';
import {
  ID,
  SANCTIONS_CLEAR_REASON,
  SANCTIONS_HIT_STATUS,
} from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import {
  AsyncResource,
  getOr,
  isSuccess,
  loading,
  success,
  useFinishedSuccessfully,
} from '@/utils/asyncResource';

export interface TableSearchParams {
  statuses?: SanctionsHitStatus[];
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
}

interface Props {
  tableRef?: React.Ref<TableRefType>;
  isEmbedded?: boolean;
  hideCleaningReason?: boolean;
  searchIds?: string;
  queryResult: QueryResult<TableData<SanctionsHit>>;
  extraTools?: ToolRenderer[];
  params?: AllParams<TableSearchParams>;
  onChangeParams?: (newParams: AllParams<TableSearchParams>) => void;
  selection?: boolean;
  selectedIds?: string[];
  onSelect?: (sanctionHitsIds: string[]) => void;
  searchedAt?: number;
  selectionActions?: SelectionAction<SanctionsHit, TableSearchParams>[];
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
}

export default function SanctionsHitsTable(props: Props) {
  const {
    isEmbedded,
    hideCleaningReason,
    queryResult,
    extraTools,
    params,
    onChangeParams,
    searchedAt,
    selection,
    selectionActions,
    tableRef,
    selectedIds,
    onSelect,
    onSanctionsHitsChangeStatus,
  } = props;

  const settings = useSettings();

  const [selectedSearchHit, setSelectedSearchHit] = useState<
    AsyncResource<SanctionsHit | undefined>
  >(success(undefined));

  const hitsNavigation = useHitsNavigation(selectedSearchHit, setSelectedSearchHit, queryResult);

  const helper = new ColumnHelper<SanctionsHit>();
  const columns: TableColumn<SanctionsHit>[] = helper.list([
    // Data fields
    helper.simple<'sanctionsHitId'>({
      title: 'Hit ID',
      key: 'sanctionsHitId',
      type: {
        ...ID,
        render: (value, { item: entity }) => (
          <Id onClick={() => setSelectedSearchHit(success(entity))}>{value}</Id>
        ),
      },
    }),
    helper.simple<'entity.name'>({
      title: 'Name',
      key: 'entity.name',
    }),
    helper.derived<string[]>({
      title: 'Countries',
      value: (item: SanctionsHit): string[] => {
        return item?.entity.countries || [];
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (countryNames, _edit) => (
          <div>
            {countryNames?.map((countryName) => (
              <CountryDisplay key={countryName} countryName={countryName} />
            ))}
          </div>
        ),
      },
      sorting: true,
    }),
    helper.derived<string[]>({
      title: 'Matched types',
      value: (entity: SanctionsHit) => {
        return entity?.entity.matchTypes;
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (types) => {
          return (
            <div>
              {types?.map((matchType) => (
                <Tag key={matchType} color="volcano">
                  {startCase(matchType)}
                </Tag>
              ))}
            </div>
          );
        },
      },
    }),
    helper.derived<string[]>({
      title: 'Relevance',
      value: (entity: SanctionsHit) => {
        return entity.entity.matchTypes;
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (matchTypes) => {
          return <div>{matchTypes?.join(', ')}</div>;
        },
      },
    }),
    helper.simple<'status'>({
      title: 'Status',
      key: 'status',
      type: SANCTIONS_HIT_STATUS,
    }),
    !hideCleaningReason &&
      helper.simple<'clearingReason'>({
        title: 'Clearing reason',
        key: 'clearingReason',
        type: SANCTIONS_CLEAR_REASON,
      }),
  ]);

  const extraFilters: ExtraFilterProps<TableSearchParams>[] = [
    {
      title: 'Search term',
      key: 'searchTerm',
      renderer: {
        kind: 'string',
      },
    },
    {
      title: 'Year of birth',
      key: 'yearOfBirth',
      renderer: {
        kind: 'number',
        min: 1900,
      },
    },
    {
      title: 'Country codes',
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
      description: '(The default value is 0.5)',
      key: 'fuzziness',
      renderer: {
        kind: 'number',
        min: 0,
        max: 1,
        step: 0.1,
      },
    },
  ];
  if (!settings.sanctions?.customSearchProfileId) {
    extraFilters.push({
      title: 'Matched type',
      key: 'types',
      renderer: {
        kind: 'select',
        options: SANCTIONS_SEARCH_TYPES.map((v) => ({ value: v, label: humanizeSnakeCase(v) })),
        mode: 'MULTIPLE',
        displayMode: 'select',
      },
    });
  }

  return (
    <>
      <QueryResultsTable<SanctionsHit, TableSearchParams>
        innerRef={tableRef}
        tableId="sanctions-search-results"
        onSelect={onSelect}
        selectedIds={selectedIds}
        selection={selection || (selectionActions != null && selectionActions.length > 0)}
        selectionInfo={{
          entityName: 'hit',
          entityCount: selectedIds?.length ?? 0,
        }}
        selectionActions={selectionActions}
        extraTools={extraTools}
        extraFilters={extraFilters}
        queryResults={queryResult}
        params={params}
        onChangeParams={onChangeParams}
        rowKey="sanctionsHitId"
        columns={columns}
        hideFilters={isEmbedded}
        pagination={'HIDE_FOR_ONE_PAGE'}
        externalHeader={isEmbedded}
        toolsOptions={{
          reload: false,
        }}
        fitHeight={isEmbedded ? 300 : true}
        cursor={queryResult.cursor}
      />
      {selectedSearchHit && (
        <SearchResultDetailsDrawer
          hitRes={selectedSearchHit}
          searchedAt={searchedAt}
          newStatus={getOr(selectedSearchHit, null)?.status === 'CLEARED' ? 'OPEN' : 'CLEARED'}
          showNavigation={true}
          onNext={hitsNavigation.onNext}
          onPrev={hitsNavigation.onPrev}
          onClose={() => setSelectedSearchHit(success(undefined))}
          onChangeStatus={
            onSanctionsHitsChangeStatus
              ? (newStatus) => {
                  if (isSuccess(selectedSearchHit) && selectedSearchHit.value != null) {
                    onSanctionsHitsChangeStatus?.(
                      [selectedSearchHit.value?.sanctionsHitId],
                      newStatus,
                    );
                    setSelectedSearchHit(success(undefined));
                  }
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function useHitsNavigation(
  selectedSearchHitRes: AsyncResource<SanctionsHit | undefined>,
  setSelectedSearchHit: (sanctionsHit: AsyncResource<SanctionsHit | undefined>) => void,
  queryResult: QueryResult<TableData<SanctionsHit>>,
): {
  onNext?: () => void;
  onPrev?: () => void;
} {
  const {
    hasPrev = false,
    hasNext = false,
    fetchNextPage,
    fetchPreviousPage,
  } = queryResult.cursor ?? {};

  const tableItems: TableDataItem<SanctionsHit>[] = useMemo(() => {
    return getOr(queryResult.data, null)?.items ?? [];
  }, [queryResult.data]);

  const [waitingNextPage, setWaitingNextPage] = useState(false);
  const [waitingPrevPage, setWaitingPrevPage] = useState(false);
  const waitingPage = waitingNextPage || waitingPrevPage;

  const isFinishedLoading = useFinishedSuccessfully(queryResult.data);
  useEffect(() => {
    if (isFinishedLoading) {
      if (waitingNextPage) {
        setWaitingNextPage(false);
        const tableItem = tableItems[0];
        setSelectedSearchHit(success(isSingleRow(tableItem) ? tableItem : undefined));
      } else if (waitingPrevPage) {
        setWaitingPrevPage(false);
        const tableItem = tableItems[tableItems.length - 1];
        setSelectedSearchHit(success(isSingleRow(tableItem) ? tableItem : undefined));
      }
    }
  }, [isFinishedLoading, waitingNextPage, waitingPrevPage, tableItems, setSelectedSearchHit]);

  const selectedSearchHit = getOr(selectedSearchHitRes, null);
  return useMemo(() => {
    const selectedSearchHitIndex = selectedSearchHit
      ? tableItems.findIndex(
          (x) => isSingleRow(x) && x.sanctionsHitId === selectedSearchHit.sanctionsHitId,
        )
      : null;

    const prevHit =
      selectedSearchHitIndex != null && tableItems != null
        ? tableItems[selectedSearchHitIndex - 1]
        : null;

    const nextHit =
      selectedSearchHitIndex != null && tableItems != null
        ? tableItems[selectedSearchHitIndex + 1]
        : null;

    let onNext: (() => void) | undefined;
    if (nextHit != null && isSingleRow(nextHit)) {
      onNext = () => setSelectedSearchHit(success(nextHit));
    } else if (hasNext) {
      onNext = () => {
        setSelectedSearchHit(loading(selectedSearchHit));
        setWaitingNextPage(true);
        fetchNextPage?.();
      };
    }

    let onPrev: (() => void) | undefined;
    if (prevHit != null && isSingleRow(prevHit)) {
      onPrev = () => setSelectedSearchHit(success(prevHit));
    } else if (hasPrev) {
      onPrev = () => {
        setSelectedSearchHit(loading(selectedSearchHit));
        setWaitingPrevPage(true);
        fetchPreviousPage?.();
      };
    }
    return {
      onNext: waitingPage ? undefined : onNext,
      onPrev: waitingPage ? undefined : onPrev,
    };
  }, [
    selectedSearchHit,
    setSelectedSearchHit,
    tableItems,
    fetchPreviousPage,
    fetchNextPage,
    hasNext,
    hasPrev,
    waitingPage,
  ]);
}
