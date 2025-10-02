import React, { useEffect, useState } from 'react';
import { useDebounce } from 'ahooks';
import { ItemType } from '../types';
import s from './style.module.less';
import SearchResultList, { MessageRenderers } from './SearchResultList';
import LastSearchList from './LastSearchList';
import { useLastSearches } from './helpers';
import { getOr, isSuccess } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import Select from '@/components/library/Select';

interface Props<T> {
  localStorageKey: string;
  initialSearch: string;
  isVisible: boolean;
  value: T[];
  onChange: (users: T[]) => void;
  onSearch: (search: string) => void;
  searchPlaceholder?: string;
  searchResult: QueryResult<PaginatedData<T>>;
  messageRenderers?: MessageRenderers;
  renderItem?: (item: T) => React.ReactNode;
}

export default function PopupContent<T extends ItemType>(props: Props<T>) {
  const {
    isVisible,
    initialSearch,
    searchResult,
    searchPlaceholder,
    messageRenderers,
    localStorageKey,
    renderItem,
    value,
    onChange,
    onSearch,
  } = props;

  const [search, setSearch] = useState(initialSearch);

  const debouncedSearch = useDebounce(search, { leading: true, wait: 500 });
  useEffect(() => {
    onSearch(debouncedSearch);
  }, [onSearch, debouncedSearch]);

  const { onAdd } = useLastSearches(localStorageKey);

  const count = isSuccess(searchResult.data) ? searchResult.data.value.total : null;
  useEffect(() => {
    if (!isVisible) {
      if (debouncedSearch !== '' && count != null && count > 0) {
        onAdd(debouncedSearch);
      }
    }
  }, [onAdd, isVisible, count, debouncedSearch]);

  useEffect(() => {
    if (!isVisible) {
      setSearch(initialSearch);
    }
  }, [isVisible, initialSearch]);

  function handleSelectItem(item: T) {
    const isSelected = value.some((x) => x.value === item.value);
    onChange(isSelected ? value.filter((x) => x.value !== item.value) : [...value, item]);
    onAdd(debouncedSearch);
  }

  const items = getOr(searchResult.data, { items: [] }).items ?? [];
  const itemsSelected = items.filter((item) => value && value.find((x) => x.value === item.value));
  return (
    <div className={s.root}>
      <div className={s.header}>
        <Select
          options={itemsSelected.map((item) => ({ value: item.value, label: item.label }))}
          mode="MULTIPLE"
          allowNewOptions
          value={value.map((x) => x.value)}
          onSearch={(searchValue) => setSearch(searchValue)}
          onChange={(newValue) => {
            if (newValue) {
              onChange(items.filter((item) => newValue.includes(item.value)));
            }
          }}
          placeholder={searchPlaceholder}
          hiddenDropdown
        />
      </div>
      {search !== '' ? (
        <div className={s.content}>
          <SearchResultList
            res={searchResult.data}
            selected={itemsSelected}
            search={debouncedSearch}
            onSelect={handleSelectItem}
            messageRenderers={messageRenderers}
            renderItem={renderItem}
          />
        </div>
      ) : (
        <div className={s.content}>
          <LastSearchList localStorageKey={localStorageKey} onSelect={setSearch} />
        </div>
      )}
    </div>
  );
}
