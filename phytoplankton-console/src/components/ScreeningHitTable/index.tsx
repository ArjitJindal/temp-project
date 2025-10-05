import React, { useState, useMemo, useEffect, useRef } from 'react';
import { startCase, uniq } from 'lodash';
import { COUNTRIES } from '@flagright/lib/constants';
import {
  humanizeSnakeCase,
  humanizeAuto,
  capitalizeWordsInternal,
} from '@flagright/lib/utils/humanize';
import {
  useFeatureEnabled,
  useHasNoSanctionsProviders,
  useSettings,
} from '../AppWrapper/Providers/SettingsProvider';
import ScreeningHitDetailsDrawer from './ScreeningHitDetailsDrawer';
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
import { ExtraFilterProps } from '@/components/library/Filter/types';
import Tag from '@/components/library/Tag';
import { ID } from '@/components/library/Table/standardDataTypes';
import { SanctionsEntity, SanctionsSearchRequestEntityType } from '@/apis';
import Id from '@/components/ui/Id';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';
import {
  useSearchProfiles,
  useScreeningProfiles,
  useDefaultManualScreeningFilters,
} from '@/hooks/api';
import { getOr, match } from '@/utils/asyncResource';
import { useHasResources } from '@/utils/user-utils';
import { getErrorMessage } from '@/utils/lang';
export interface TableSearchParams {
  statuses?: SanctionsHitStatus[];
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
  entityType?: SanctionsSearchRequestEntityType;
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

export const ENTITY_TYPE_OPTIONS = [
  { label: 'Person', value: 'PERSON' },
  { label: 'Business', value: 'BUSINESS' },
];

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
  const canEditManualScreeningFilters = useHasResources([
    'write:::screening/manual-screening-filters/*',
  ]);

  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
  const isScreeningProfileEnabled = hasFeatureAcuris || hasFeatureDowJones;

  const searchProfileResult = useSearchProfiles(
    { filterSearchProfileStatus: 'ENABLED' },
    { enabled: !isScreeningProfileEnabled, staleTime: 300000 },
  );

  const screeningProfilesResult = useScreeningProfiles(
    { filterScreeningProfileStatus: 'ENABLED' },
    { enabled: isScreeningProfileEnabled, staleTime: 300000 },
  );
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
      type: {
        render: (value) => <span>{capitalizeWordsInternal(value ?? '')}</span>,
      },
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

  const acurisOptions = useMemo(() => {
    if (!isScreeningProfileEnabled) {
      return [];
    }
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'acuris')
        ?.screeningTypes ?? ACURIS_SANCTIONS_SEARCH_TYPES
    );
  }, [settings, isScreeningProfileEnabled]);

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

  const options = uniq([...openSanctionsOptions, ...acurisOptions, ...dowJonesOptions]).map(
    (option) => ({
      label: humanizeAuto(option),
      value: option,
    }),
  );

  const searchProfiles = getOr(searchProfileResult.data, { items: [], total: 0 }).items;
  const selectedProfile = searchProfiles.find(
    (profile) => profile.searchProfileId === (params as any)?.searchProfileId,
  );

  const searchProfileId = useMemo(() => (params as any)?.searchProfileId, [params]);

  const initializedProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      searchProfileId &&
      selectedProfile &&
      initializedProfileRef.current !== searchProfileId &&
      onChangeParams &&
      params
    ) {
      initializedProfileRef.current = searchProfileId;
      const updatedParams = { ...params };
      const searchParams = updatedParams as any;
      let hasChanges = false;
      if (selectedProfile.fuzziness !== undefined) {
        searchParams.fuzziness = selectedProfile.fuzziness;
        hasChanges = true;
      }
      if (selectedProfile.types && selectedProfile.types.length > 0) {
        searchParams.types = selectedProfile.types;
        hasChanges = true;
      }
      if (selectedProfile.nationality && selectedProfile.nationality.length > 0) {
        searchParams.nationality = selectedProfile.nationality;
        hasChanges = true;
      }

      if (hasChanges) {
        onChangeParams(updatedParams);
      }
    }
  }, [searchProfileId, selectedProfile, onChangeParams, params]);

  const readOnlyFilterKeys = selectedProfile
    ? [
        ...(selectedProfile.fuzziness !== undefined ? ['fuzziness'] : []),
        ...(selectedProfile.types && selectedProfile.types.length > 0 ? ['types'] : []),
        ...(selectedProfile.nationality && selectedProfile.nationality.length > 0
          ? ['nationality']
          : []),
      ]
    : [];

  const extraFilters: ExtraFilterProps<TableSearchParams>[] = [
    {
      title: 'Search term',
      key: 'searchTerm',
      renderer: {
        kind: 'string',
      },
    },
    ...(params?.entityType === 'PERSON' || !params?.entityType
      ? [
          {
            title: 'Year of birth',
            key: 'yearOfBirth',
            renderer: {
              kind: 'year',
            },
          } as ExtraFilterProps<TableSearchParams>,
        ]
      : []),
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
    {
      title: 'User type',
      key: 'entityType',
      renderer: {
        kind: 'select',
        options: ENTITY_TYPE_OPTIONS,
        mode: 'SINGLE',
        displayMode: 'select',
      },
    },
  ];

  if (isScreeningProfileEnabled) {
    const options = match(screeningProfilesResult.data, {
      init: () => [],
      loading: () => [{ label: 'Loading profiles...', value: '', isDisabled: true }],
      success: ({ items: screeningProfiles }) =>
        screeningProfiles.map((profile) => ({
          label: profile.screeningProfileName ?? '',
          value: profile.screeningProfileId ?? '',
        })),
      failed: (error) => [
        {
          label: `Error while loading profiles! ${getErrorMessage(error)}`,
          value: '',
          isDisabled: true,
        },
      ],
    });

    extraFilters.unshift({
      title: 'Screening profile',
      key: 'screeningProfileId',
      pinFilterToLeft: true,
      showFilterByDefault: true,
      renderer: {
        kind: 'select',
        options: options,
        mode: 'SINGLE',
        displayMode: 'select',
      },
    });
  } else if (searchProfiles.length > 0) {
    extraFilters.unshift({
      title: 'Search profile',
      key: 'searchProfileId',
      pinFilterToLeft: true,
      showFilterByDefault: true,
      renderer: {
        kind: 'select',
        options: searchProfiles.map((profile) => ({
          label: profile.searchProfileName ?? '',
          value: profile.searchProfileId ?? '',
        })),
        mode: 'SINGLE',
        displayMode: 'select',
      },
    });
  }

  if (isSanctionsEnabledWithDataProvider) {
    extraFilters.push({
      title:
        params?.entityType === 'BUSINESS' ? 'Country of registration' : 'Country of nationality',
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

  const restrictedByPermission = new Set(['fuzziness', 'nationality', 'types', 'entityType']);

  const defaultManualScreeningFilters = useDefaultManualScreeningFilters({
    enabled: isScreeningProfileEnabled,
  });

  const isFilterLockedByPermission = (key: string): boolean => {
    if (canEditManualScreeningFilters) {
      return false;
    }

    if (isScreeningProfileEnabled) {
      if (restrictedByPermission.has(key)) {
        const defaults = getOr(defaultManualScreeningFilters.data, null) as any;
        const value = defaults?.[key];
        const isSet = value != null && (!Array.isArray(value) || value.length > 0);
        if (isSet) {
          return true;
        }
      }
      if (key === 'screeningProfileId') {
        const screeningProfiles = getOr(screeningProfilesResult.data, { items: [], total: 0 });
        const profiles = (screeningProfiles.items ?? []) as any[];
        const hasDefault = Array.isArray(profiles) && profiles.some((p) => p?.isDefault);
        if (hasDefault) {
          return true;
        }
      }
    } else {
      if (key === 'searchProfileId') {
        const searchProfilesRes = getOr(searchProfileResult.data, { items: [], total: 0 });
        const profiles = (searchProfilesRes.items ?? []) as any[];
        const hasDefault = Array.isArray(profiles) && profiles.some((p) => p?.isDefault);
        if (hasDefault) {
          return true;
        }
      }
    }

    return false;
  };

  extraFilters.forEach((filter) => {
    const renderer = filter.renderer as any;

    let isReadOnly = readOnly || readOnlyFilterKeys.includes(filter.key);

    if (isFilterLockedByPermission(filter.key)) {
      isReadOnly = true;
    }

    renderer.readOnly = isReadOnly;
    renderer.filterKey = filter.key;
  });

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
        pagination
        externalHeader={isEmbedded}
        toolsOptions={{
          reload: false,
        }}
        fitHeight
        cursor={queryResult.cursor}
        readOnlyFilters={readOnly}
        sizingMode="FULL_WIDTH"
      />
      <ScreeningHitDetailsDrawer
        hit={selectedSearchHit ?? null}
        searchedAt={searchedAt}
        onClose={() => setSelectedSearchHit(undefined)}
      />
    </>
  );
}
