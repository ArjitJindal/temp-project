import React, { useState } from 'react';
import { ItemType } from './types';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import { PaginatedData, useQuery } from '@/utils/queries/hooks';
import { useId } from '@/utils/hooks';

interface Item extends ItemType {}

export default function (): JSX.Element {
  const [search, setSearch] = useState('');
  const queryResult = useQuery<PaginatedData<Item>>(['test', search], async () => {
    const items: Item[] = [
      'William Ashbless',
      'Bilitis',
      'Achmet Borumborad',
      'George P. Burdell',
      'Eddie Burrup',
      'Johnny "The Celestial Comet" Chung',
      'Allegra Coleman',
      'Tom Collins',
      'Helen Demidenko',
      'Aimi Eguchi',
      'Frederick R. Ewing',
      'Hugo N. Frye',
      'Anthony Godby Johnson',
      'Kilroy',
      'Ern Malley',
      'Lillian Virginia Mountweazel',
      'Lucian Yahoo Dragoman',
      'Karyl Robin-Evans',
      'H. Rochester Sneath',
      'Georg Paul Thomann',
      'Piotr Zak',
    ].map((name, i) => ({ label: name, value: i.toString() }));
    const searchResult = items.filter(
      (x) => x.label.toLowerCase().indexOf(search.toLowerCase()) != -1,
    );
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          items: searchResult.slice(0, 10),
          total: items.length,
        });
      }, 500 + Math.random() * 2000);
    });
  });

  const [values, setValues] = useState<Item[]>([]);
  const localStorageKey = useId(`local-storage-key`);

  return (
    <>
      <UseCase title={'SearchQuickFilter'}>
        <Component
          title={'Case ID'}
          localStorageKey={localStorageKey}
          searchResult={queryResult}
          value={values}
          onChange={setValues}
          onSearch={setSearch}
        />
      </UseCase>
    </>
  );
}
