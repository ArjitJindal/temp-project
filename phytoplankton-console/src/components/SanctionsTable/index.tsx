import React, { useState } from 'react';
import { startCase } from 'lodash';
import { COUNTRIES } from '@flagright/lib/constants';
import { useSettings } from '../AppWrapper/Providers/SettingsProvider';
import SearchResultDetailsDrawer from './SearchResultDetailsDrawer';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams, TableColumn, TableData, ToolRenderer } from '@/components/library/Table/types';
import { ComplyAdvantageSearchHit } from '@/apis/models/ComplyAdvantageSearchHit';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { QueryResult } from '@/utils/queries/types';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';
import { humanizeSnakeCase } from '@/utils/humanize';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import Tag from '@/components/library/Tag';

interface TableSearchParams {
  searchTerm?: string;
  fuzziness?: number;
  countryCodes?: Array<string>;
  yearOfBirth?: number;
}

interface Props {
  isEmbedded?: boolean;
  searchId?: string;
  queryResult: QueryResult<TableData<ComplyAdvantageSearchHit>>;
  extraTools?: ToolRenderer[];
  params?: AllParams<TableSearchParams>;
  onChangeParams?: (newParams: AllParams<TableSearchParams>) => void;
  searchedAt?: number;
}

export default function SanctionsTable(props: Props) {
  const { isEmbedded, queryResult, extraTools, params, onChangeParams, searchedAt } = props;

  const [selectedSearchHit, setSelectedSearchHit] = useState<ComplyAdvantageSearchHit>();
  const settings = useSettings();

  const helper = new ColumnHelper<ComplyAdvantageSearchHit>();
  const columns: TableColumn<ComplyAdvantageSearchHit>[] = helper.list([
    // Data fields
    helper.simple<'doc.entity_type'>({
      title: 'Type',
      key: 'doc.entity_type',
      type: {
        render: (value) => <Tag>{startCase(value)}</Tag>,
      },
    }),
    helper.simple<'doc.name'>({
      title: 'Name',
      key: 'doc.name',
      type: {
        render: (name, { item: entity }) => (
          <div>{<a onClick={() => setSelectedSearchHit(entity)}>{name}</a>}</div>
        ),
      },
    }),
    helper.derived<string>({
      title: 'Date of birth',
      value: (item: ComplyAdvantageSearchHit): string | undefined => {
        const fields = item?.doc?.fields;
        const dob =
          fields?.find(
            (field) => field.source === 'complyadvantage' && field.tag === 'date_of_birth',
          )?.value ?? fields?.find((field) => field.tag === 'date_of_birth')?.value;
        return dob;
      },
      type: {
        render: (dob) => {
          return <>{dob}</>;
        },
      },
    }),
    helper.derived<string>({
      title: 'Countries',
      value: (item: ComplyAdvantageSearchHit): string | undefined => {
        return item?.doc?.fields?.find((field) => field.name === 'Countries')?.value;
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (countryNames, _edit) => (
          <>
            {countryNames?.split(/,\s*/)?.map((countryName) => (
              <CountryDisplay key={countryName} countryName={countryName} />
            ))}
          </>
        ),
      },
      sorting: true,
    }),
    helper.derived<string[]>({
      title: 'Matched types',
      value: (entity: ComplyAdvantageSearchHit) => {
        return entity.doc?.types;
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
      value: (entity: ComplyAdvantageSearchHit) => {
        return entity.doc?.types;
      },
      type: {
        defaultWrapMode: 'WRAP',
        render: (match_types) => {
          return (
            <div>
              {match_types?.map((matchType) => (
                <Tag key={matchType}>{startCase(matchType)}</Tag>
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
      <QueryResultsTable<ComplyAdvantageSearchHit, TableSearchParams>
        tableId="sanctions-search-results"
        extraTools={extraTools}
        extraFilters={extraFilters}
        queryResults={queryResult}
        params={params}
        onChangeParams={onChangeParams}
        rowKey="doc.id"
        columns={columns}
        hideFilters={isEmbedded}
        pagination={false}
        externalHeader={isEmbedded}
        toolsOptions={{
          reload: false,
        }}
        fitHeight={isEmbedded ? 400 : true}
      />
      {selectedSearchHit && (
        <SearchResultDetailsDrawer
          hit={selectedSearchHit}
          searchedAt={searchedAt}
          onClose={() => setSelectedSearchHit(undefined)}
        />
      )}
    </>
  );
}
