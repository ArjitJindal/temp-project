import React, { useState, useMemo } from 'react';
import { startCase, uniq } from 'lodash';
import { COUNTRIES } from '@flagright/lib/constants';
import { humanizeSnakeCase, humanizeAuto } from '@flagright/lib/utils/humanize';
import {
  useFeatureEnabled,
  useHasNoSanctionsProviders,
  useSettings,
} from '../AppWrapper/Providers/SettingsProvider';
import ComplyAdvantageHitDetailsDrawer from './ComplyAdvantageHitDetailsDrawer';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  AllParams,
  TableColumn,
  TableData,
  ToolRenderer,
  SelectionAction,
  TableRefType,
} from '@/components/library/Table/types';
import { SanctionsHitStatus } from '@/apis/models/SanctionsHitStatus';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { QueryResult } from '@/utils/queries/types';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import Tag from '@/components/library/Tag';
import { ID, STRING } from '@/components/library/Table/standardDataTypes';
import { SanctionsEntity } from '@/apis';
import Id from '@/components/ui/Id';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';

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
  queryResult: QueryResult<TableData<SanctionsEntity>>;
  extraTools?: ToolRenderer[];
  params?: AllParams<TableSearchParams>;
  onChangeParams?: (newParams: AllParams<TableSearchParams>) => void;
  selection?: boolean;
  selectedIds?: string[];
  onSelect?: (sanctionHitsIds: string[]) => void;
  searchedAt?: number;
  selectionActions?: SelectionAction<SanctionsEntity, TableSearchParams>[];
  readOnly?: boolean;
}

export default function SanctionsSearchTable(props: Props) {
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
    readOnly = false,
  } = props;

  const [selectedSearchHit, setSelectedSearchHit] = useState<SanctionsEntity>();
  const settings = useSettings();
  const isSanctionsEnabledWithDataProvider = !useHasNoSanctionsProviders();

  const helper = new ColumnHelper<SanctionsEntity>();
  const columns: TableColumn<SanctionsEntity>[] = helper.list([
    // Data fields
    helper.simple<'id'>({
      title: 'Entity ID',
      key: 'id',
      type: {
        ...ID,
        render: (value, { item: entity }) => (
          <Id onClick={() => setSelectedSearchHit(entity)}>{value}</Id>
        ),
      },
    }),
    helper.simple<'name'>({
      title: 'Name',
      key: 'name',
      type: STRING,
    }),
    helper.derived<string[]>({
      title: 'Countries',
      value: (item: SanctionsEntity): string[] => {
        return item?.countries || [];
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
      value: (entity: SanctionsEntity) => {
        return entity.types;
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
      value: (entity) => {
        return entity.matchTypes;
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (matchType) => {
          return (
            <div>{matchType?.map((matchType) => humanizeSnakeCase(matchType)).join(', ')}</div>
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
        kind: 'year',
      },
    },
    {
      title: 'Fuzziness',
      description: '(The default value is 0.5)',
      key: 'fuzziness',
      renderer: {
        kind: 'number',
        displayAs: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.5,
      },
    },
  ];

  if (isSanctionsEnabledWithDataProvider) {
    extraFilters.push({
      title: 'Nationality',
      key: 'nationality',
      renderer: {
        kind: 'select',
        options: Object.entries(COUNTRIES).map((entry) => ({ value: entry[0], label: entry[1] })),
        mode: 'MULTIPLE',
        displayMode: 'select',
      },
    });
    extraFilters.push({
      title: 'Document ID',
      key: 'documentId',
      renderer: {
        kind: 'string',
      },
    });
  }

  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureSanctions = useFeatureEnabled('SANCTIONS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');

  // Generate options for each provider
  const acurisOptions = useMemo(() => {
    if (!hasFeatureAcuris) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'acuris')
        ?.screeningTypes ?? ACURIS_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureAcuris]);

  const openSanctionsOptions = useMemo(() => {
    if (!hasFeatureOpenSanctions) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find(
        (type) => type.provider === 'open-sanctions',
      )?.screeningTypes ?? OPEN_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureOpenSanctions]);

  const dowJonesOptions = useMemo(() => {
    if (!hasFeatureDowJones) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'dowjones')
        ?.screeningTypes ?? DOW_JONES_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, hasFeatureDowJones]);

  const sanctionsOptions = useMemo(() => {
    if (!hasFeatureSanctions || hasFeatureAcuris || hasFeatureOpenSanctions || hasFeatureDowJones) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find(
        (type) => type.provider === 'comply-advantage',
      )?.screeningTypes ?? SANCTIONS_SEARCH_TYPES
    );
  }, [
    settings,
    hasFeatureSanctions,
    hasFeatureAcuris,
    hasFeatureOpenSanctions,
    hasFeatureDowJones,
  ]);

  const options = uniq([
    ...openSanctionsOptions,
    ...acurisOptions,
    ...sanctionsOptions,
    ...dowJonesOptions,
  ]).map((option) => ({
    label: humanizeAuto(option),
    value: option,
  }));

  if (!settings.sanctions?.customSearchProfileId) {
    extraFilters.push({
      title: 'Matched type',
      key: 'types',
      renderer: {
        kind: 'select',
        options: options,
        mode: 'MULTIPLE',
        displayMode: 'select',
      },
    });
  }

  return (
    <>
      <QueryResultsTable<SanctionsEntity, TableSearchParams>
        innerRef={tableRef}
        tableId="sanctions-search-results"
        onSelect={onSelect}
        selectedIds={selectedIds}
        selection={selection || (selectionActions != null && selectionActions.length > 0)}
        selectionInfo={{
          entityName: 'entity',
          entityCount: selectedIds?.length ?? 0,
        }}
        selectionActions={selectionActions}
        extraTools={extraTools}
        extraFilters={extraFilters}
        queryResults={queryResult}
        params={params}
        onChangeParams={onChangeParams}
        rowKey="id"
        columns={columns}
        hideFilters={isEmbedded}
        pagination={'HIDE_FOR_ONE_PAGE'}
        externalHeader={isEmbedded}
        toolsOptions={{
          reload: false,
        }}
        fitHeight={isEmbedded ? 300 : false}
        cursor={queryResult.cursor}
        readOnlyFilters={readOnly}
      />
      <ComplyAdvantageHitDetailsDrawer
        hit={selectedSearchHit ?? null}
        searchedAt={searchedAt}
        onClose={() => setSelectedSearchHit(undefined)}
      />
    </>
  );
}
