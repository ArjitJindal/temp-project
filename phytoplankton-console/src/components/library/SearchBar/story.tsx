import React, { useState } from 'react';
import { useDebounce } from 'ahooks';
import { ItemGroup } from './SearchBarDropdown';
import SearchBar from '.';
import { UseCase } from '@/pages/storybook/components';
import { RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import { FilterProps } from '@/components/library/Filter/types';
import { useQuery } from '@/utils/queries/hooks';

const BEST_RESULTS_LENGTH = 3;

interface FilterParams {}

function Example() {
  const [search, setSearch] = useState<string>();
  const [filterParams, setFilterParams] = useState<FilterParams>({});
  const debouncedSearchTerm = useDebounce(search, { wait: 500 });

  const queryResult = useQuery(['storybook', 'example', debouncedSearchTerm], async () => {
    return await fetchItems(debouncedSearchTerm);
  });

  return (
    <SearchBar
      search={search}
      onSearch={setSearch}
      filterParams={filterParams}
      onChangeFilterParams={setFilterParams}
      filters={filters}
      items={queryResult.data}
      placeholder={`Search for any rule or use case using natural language`}
      onSelectItem={(item) => {
        console.info('Selected item', item);
      }}
    />
  );
}

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Combined'}>
        <Example />
      </UseCase>
    </>
  );
}

/*
  Utils
 */

const filters: FilterProps<FilterParams>[] = [
  {
    key: 'rule_nature',
    title: 'Rule nature',
    kind: 'AUTO',
    dataType: {
      kind: 'select',
      options: RULE_NATURE_OPTIONS,
      mode: 'SINGLE',
      displayMode: 'list',
    },
  },
  {
    key: 'rule_typology',
    title: 'Rule typology',
    kind: 'AUTO',
    dataType: {
      kind: 'select',
      options: [
        'Account activity, inconsistent with customer profile',
        'Avoiding reporting limits',
        'Acquiring Fraud',
      ].map((label) => ({ label, value: label })),
      mode: 'SINGLE',
      displayMode: 'select',
    },
  },
];

async function fetchItems(search?: string): Promise<ItemGroup[]> {
  const items = [
    {
      ruleNumber: 'R-30',
      ruleName: 'High velocity sender',
      ruleDescription: 'If a sender sends >= ‘x’ transactions within time ‘t’',
    },
    {
      ruleNumber: 'R-1',
      ruleName: 'High velocity receiver',
      ruleDescription: 'If a receiver receives >= ‘x’ transactions within time ‘t’',
    },
    {
      ruleNumber: 'R-119',
      ruleName: 'High velocity between the same parties.',
      ruleDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      ruleNumber: 'R-39',
      ruleName: 'High velocity sender',
      ruleDescription: 'If a sender sends >= ‘x’ transactions within time ‘t’',
    },
    {
      ruleNumber: 'R-2',
      ruleName: 'High velocity receiver',
      ruleDescription: 'If a receiver receives >= ‘x’ transactions within time ‘t’',
    },
    {
      ruleNumber: 'R-119',
      ruleName: 'High velocity between the same parties.',
      ruleDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      ruleNumber: 'R-11',
      ruleName: 'High velocity between the same parties.',
      ruleDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      ruleNumber: 'R-45',
      ruleName: 'High velocity between the same parties.',
      ruleDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      ruleNumber: 'R-81',
      ruleName: 'High velocity between the same parties.',
      ruleDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
  ];

  const filteredItems = items.filter((item) => {
    if (!search) {
      return true;
    }
    return (
      item.ruleName.toLowerCase().includes(search.toLowerCase()) ||
      item.ruleDescription.toLowerCase().includes(search.toLowerCase())
    );
  });
  const groups: ItemGroup[] = [
    {
      title: 'Best results',
      items: filteredItems.slice(0, BEST_RESULTS_LENGTH),
    },
    {
      title: 'Other related results',
      items: filteredItems.slice(BEST_RESULTS_LENGTH),
    },
  ];
  const filteredGroups = groups.filter((x) => x.items.length > 0);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(filteredGroups);
    }, Math.round(200 + 2000 * Math.random()));
  });
}
