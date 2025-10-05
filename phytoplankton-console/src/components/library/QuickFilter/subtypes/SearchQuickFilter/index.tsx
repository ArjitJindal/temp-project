import React from 'react';
import PopupContent from './PopupContent';
import { MessageRenderers } from './PopupContent/SearchResultList';
import { ItemType } from './types';
import QuickFilter from '@/components/library/QuickFilter';
import type { QueryResult } from '@/utils/queries/types';
import type { PaginatedData } from '@/utils/queries/hooks';

interface Props<T> {
  title: string;
  value: T[];
  localStorageKey: string;
  onChange: (newValue: T[]) => void;
  onSearch: (search: string) => void;
  searchResult: QueryResult<PaginatedData<T>>;
  messageRenderers?: MessageRenderers;
  renderItem?: (item: T) => React.ReactNode;
}

export default function SearchQuickFilter<T extends ItemType>(props: Props<T>) {
  const {
    title,
    searchResult,
    messageRenderers,
    localStorageKey,
    value,
    renderItem,
    onSearch,
    onChange,
  } = props;

  return (
    <QuickFilter
      title={title}
      buttonText={
        title + (value.length > 0 ? `: ${value.map(({ label }) => label).join(', ')}` : '')
      }
      onClear={
        value.length === 0
          ? undefined
          : () => {
              onChange([]);
            }
      }
    >
      {({ isOpen }) => (
        <PopupContent<T>
          searchResult={searchResult}
          initialSearch={''}
          localStorageKey={localStorageKey}
          isVisible={isOpen}
          value={value}
          onChange={onChange}
          onSearch={onSearch}
          searchPlaceholder={'Search'}
          messageRenderers={messageRenderers}
          renderItem={renderItem}
        />
      )}
    </QuickFilter>
  );
}
