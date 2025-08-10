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
      placeholder={`Search for any rule or use-case using natural language`}
      onSelectItem={(item) => {
        console.info('Selected item', item);
      }}
      isAIEnabled
      setIsAIEnabled={() => {}}
      onClear={() => {}}
    />
  );
}

function MinimalExample() {
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
      placeholder={`Search for any rule or use-case using natural language`}
      onSelectItem={(item) => {
        console.info('Selected item', item);
      }}
      onClear={() => {}}
      variant="minimal"
    />
  );
}

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Combined'}>
        <Example />
      </UseCase>
      <UseCase title={'Minimal'}>
        <MinimalExample />
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
      itemId: 'R-30',
      itemName: 'High velocity sender',
      itemDescription: 'If a sender sends >= ‘x’ transactions within time ‘t’',
    },
    {
      itemId: 'R-1',
      itemName: 'High velocity receiver',
      itemDescription: 'If a receiver receives >= ‘x’ transactions within time ‘t’',
    },
    {
      itemId: 'R-119',
      itemName: 'High velocity between the same parties.',
      itemDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      itemId: 'R-39',
      itemName: 'High velocity sender',
      itemDescription: 'If a sender sends >= ‘x’ transactions within time ‘t’',
    },
    {
      itemId: 'R-2',
      itemName: 'High velocity receiver',
      itemDescription: 'If a receiver receives >= ‘x’ transactions within time ‘t’',
    },
    {
      itemId: 'R-119',
      itemName: 'High velocity between the same parties.',
      itemDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      itemId: 'R-11',
      itemName: 'High velocity between the same parties.',
      itemDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      itemId: 'R-45',
      itemName: 'High velocity between the same parties.',
      itemDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
    {
      itemId: 'R-81',
      itemName: 'High velocity between the same parties.',
      itemDescription: 'Same parties transacting among themselves >= ‘x’ times in ‘t’',
    },
  ];

  const filteredItems = items.filter((item) => {
    if (!search) {
      return true;
    }
    return (
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      item.itemDescription.toLowerCase().includes(search.toLowerCase())
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
