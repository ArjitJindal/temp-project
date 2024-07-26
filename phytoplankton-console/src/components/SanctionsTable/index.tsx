import React, { useState } from 'react';
import { startCase } from 'lodash';
import { COUNTRIES } from '@flagright/lib/constants';
import { useSettings } from '../AppWrapper/Providers/SettingsProvider';
import SearchResultDetailsDrawer from './SearchResultDetailsDrawer';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  AllParams,
  TableColumn,
  TableData,
  ToolRenderer,
  SelectionAction,
  TableRefType,
} from '@/components/library/Table/types';
import { SanctionsHit } from '@/apis/models/SanctionsHit';
import { SanctionsHitStatus } from '@/apis/models/SanctionsHitStatus';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { QueryResult } from '@/utils/queries/types';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';
import { humanizeSnakeCase } from '@/utils/humanize';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import Tag from '@/components/library/Tag';
import { ID, SANCTIONS_HIT_STATUS } from '@/components/library/Table/standardDataTypes';
import { notEmpty } from '@/utils/array';
import Id from '@/components/ui/Id';

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

export default function SanctionsTable(props: Props) {
  const {
    isEmbedded,
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

  const [selectedSearchHit, setSelectedSearchHit] = useState<SanctionsHit>();
  const settings = useSettings();

  const helper = new ColumnHelper<SanctionsHit>();
  const columns: TableColumn<SanctionsHit>[] = helper.list([
    // Data fields
    helper.simple<'sanctionsHitId'>({
      title: 'Hit ID',
      key: 'sanctionsHitId',
      type: {
        ...ID,
        render: (value, { item: entity }) => (
          <Id onClick={() => setSelectedSearchHit(entity)}>{value}</Id>
        ),
      },
    }),
    helper.simple<'caEntity.name'>({
      title: 'Name',
      key: 'caEntity.name',
    }),
    helper.derived<string[]>({
      title: 'Countries',
      value: (item: SanctionsHit): string[] => {
        return (
          item?.caEntity?.fields
            ?.filter((field) => field.name === 'Countries')
            .map(({ value }) => value)
            .filter(notEmpty) ?? []
        );
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
        return entity.caEntity?.types;
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
        return entity.caMatchTypes;
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (match_types) => {
          return (
            <div>{match_types?.map((matchType) => humanizeSnakeCase(matchType)).join(', ')}</div>
          );
        },
      },
    }),
    helper.simple<'status'>({
      title: 'Status',
      key: 'status',
      type: SANCTIONS_HIT_STATUS,
    }),
    helper.simple<'clearingReason'>({
      title: 'Clearing reason',
      key: 'clearingReason',
      type: {
        defaultWrapMode: 'WRAP',
        render: (clearing_reasons) => {
          return (
            <div>
              {clearing_reasons?.map((clearingReason: string) => (
                <Tag key={clearingReason} color="gray">
                  {humanizeSnakeCase(clearingReason)}
                </Tag>
              ))}
            </div>
          );
        },
      },
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
          hit={selectedSearchHit}
          searchedAt={searchedAt}
          onClose={() => setSelectedSearchHit(undefined)}
          newStatus={selectedSearchHit.status === 'CLEARED' ? 'OPEN' : 'CLEARED'}
          onChangeStatus={
            onSanctionsHitsChangeStatus
              ? (newStatus) => {
                  onSanctionsHitsChangeStatus?.([selectedSearchHit.sanctionsHitId], newStatus);
                  setSelectedSearchHit(undefined);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
