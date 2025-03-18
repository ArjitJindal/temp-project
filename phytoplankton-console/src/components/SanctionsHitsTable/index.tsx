import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { compact, startCase } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import SearchResultDetailsDrawer from './SearchResultDetailsDrawer';
import s from './index.module.less';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  AllParams,
  isSingleRow,
  SelectionAction,
  SelectionInfo,
  TableColumn,
  TableData,
  TableDataItem,
  TableRefType,
  ToolRenderer,
} from '@/components/library/Table/types';
import { SanctionsHitStatus } from '@/apis/models/SanctionsHitStatus';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { Cursor, QueryResult } from '@/utils/queries/types';
import Tag from '@/components/library/Tag';
import {
  ID,
  SANCTIONS_CLEAR_REASON,
  SANCTIONS_HIT_STATUS,
  STRING,
} from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import {
  AsyncResource,
  getOr,
  init,
  isSuccess,
  loading,
  success,
  useFinishedSuccessfully,
} from '@/utils/asyncResource';
import UpdatedTag from '@/components/library/Tag/UpdatedTag';
import { SanctionsHit } from '@/apis';
import { SanctionsHitsTableParams } from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';

interface Props {
  tableRef?: React.Ref<TableRefType>;
  hideCleaningReason?: boolean;
  searchIds?: string;
  queryResult: QueryResult<TableData<SanctionsHit>>;
  extraTools?: ToolRenderer[];
  params?: AllParams<SanctionsHitsTableParams>;
  onChangeParams?: (newParams: AllParams<SanctionsHitsTableParams>) => void;
  selection?: boolean;
  selectedIds?: string[];
  onSelect?: (sanctionHitsIds: string[]) => void;
  searchedAt?: number;
  selectionActions?: SelectionAction<SanctionsHit, SanctionsHitsTableParams>[];
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
  alertCreatedAt?: number;
  showComment?: boolean;
  selectionInfo?: SelectionInfo;
  fitHeight?: boolean | number;
}
// todo: delete when have information in sanction hit
const TMP_IS_UPDATED = false;

export default function SanctionsHitsTable(props: Props) {
  const {
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
    alertCreatedAt,
    showComment,
    selectionInfo,
    fitHeight = 300,
  } = props;
  const [selectedSearchHit, setSelectedSearchHit] = useState<
    AsyncResource<SanctionsHit | undefined>
  >(success(undefined));

  const handleChangeCursor = useCallback(
    (from: string) => {
      if (params) {
        onChangeParams?.({ ...params, from });
      }
    },
    [params, onChangeParams],
  );
  const hitsNavigation = useHitsNavigation(
    selectedSearchHit,
    setSelectedSearchHit,
    queryResult,
    handleChangeCursor,
  );

  const helper = new ColumnHelper<SanctionsHit>();
  const columns: TableColumn<SanctionsHit>[] = helper.list([
    // Data fields
    helper.simple<'sanctionsHitId'>({
      title: 'Hit ID',
      key: 'sanctionsHitId',
      type: {
        ...ID,
        render: (value, { item: entity }) => (
          <div className={s.idWrapper}>
            <Id onClick={() => setSelectedSearchHit(success(entity))}>{value}</Id>
            {TMP_IS_UPDATED && <UpdatedTag />}
          </div>
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
        return compact(item.entity.countries);
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
        return entity.entity.types;
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (matchTypes) => {
          return (
            <div>
              {compact(matchTypes)
                ?.map((type) => humanizeAuto(type))
                .join(', ')}
            </div>
          );
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
    showComment &&
      helper.simple<'comment'>({
        title: 'Comment',
        key: 'comment',
        type: {
          ...STRING,
          defaultWrapMode: 'WRAP',
        },
        enableResizing: false,
      }),
  ]);
  return (
    <>
      <QueryResultsTable<SanctionsHit, SanctionsHitsTableParams>
        innerRef={tableRef}
        tableId="sanctions-search-results"
        onSelect={onSelect}
        selectedIds={selectedIds}
        selection={selection || (selectionActions != null && selectionActions.length > 0)}
        selectionInfo={selectionInfo}
        selectionActions={selectionActions}
        extraTools={extraTools}
        queryResults={queryResult}
        params={params}
        onChangeParams={onChangeParams}
        rowKey="sanctionsHitId"
        columns={columns}
        hideFilters={true}
        pagination={'HIDE_FOR_ONE_PAGE'}
        externalHeader={false}
        toolsOptions={false}
        fitHeight={fitHeight}
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
          alertCreatedAt={alertCreatedAt}
        />
      )}
    </>
  );
}

function useHitsNavigation(
  selectedSearchHitRes: AsyncResource<SanctionsHit | undefined>,
  setSelectedSearchHit: (sanctionsHit: AsyncResource<SanctionsHit | undefined>) => void,
  queryResult: QueryResult<TableData<SanctionsHit>>,
  onChangeCursor: (from: string) => void,
): {
  onNext?: () => void;
  onPrev?: () => void;
} {
  const { prev, next, hasNext, hasPrev } = getOr<Cursor>(queryResult.cursor ?? init(), {});

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
        if (hasNext && next) {
          setWaitingNextPage(true);
          onChangeCursor(next);
        }
      };
    }

    let onPrev: (() => void) | undefined;
    if (prevHit != null && isSingleRow(prevHit)) {
      onPrev = () => setSelectedSearchHit(success(prevHit));
    } else if (hasPrev) {
      onPrev = () => {
        setSelectedSearchHit(loading(selectedSearchHit));
        if (hasPrev) {
          setWaitingPrevPage(true);
          onChangeCursor(prev ?? '');
        }
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
    next,
    prev,
    hasNext,
    hasPrev,
    waitingPage,
    onChangeCursor,
  ]);
}
