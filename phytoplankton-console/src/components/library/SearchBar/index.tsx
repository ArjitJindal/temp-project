import { useState, useEffect, useRef, useCallback } from 'react';
import s from './index.module.less';
import SearchBarField from './SearchBarField';
import SearchBarDropdown, { ItemGroup, Item } from './SearchBarDropdown';
import { isDeepChild } from '@/utils/browser';
import { FilterProps } from '@/components/library/Filter/types';
import { AsyncResource } from '@/utils/asyncResource';

export interface SearchBarProps<FilterParams> {
  search?: string;
  filters?: FilterProps<FilterParams>[];
  filterParams?: FilterParams;
  items: AsyncResource<ItemGroup[]>;
  placeholder?: string;
  onSearch?: (newValue: string | undefined) => void;
  onChangeFilterParams?: (filterParams: FilterParams) => void;
  onSelectItem?: (item: Item) => void;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  emptyState?: {
    title: string;
    description: string;
    onAction?: () => void;
    actionLabel?: string;
  };
}

export default function SearchBar<FilterParams extends object = object>(
  props: SearchBarProps<FilterParams>,
) {
  const { search, onSearch, onSelectItem, onEnter } = props;
  const { items, filters, onChangeFilterParams, filterParams, placeholder } = props;
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isFiltersVisible, setFiltersVisible] = useState(false);
  const [isAllItemsShown, setAllItemsShown] = useState(false);
  const [isEnterPressed, setEnterPressed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (e) => {
      const isChild = isDeepChild(rootRef.current, e.target as HTMLElement | null);
      setDropdownVisible(isChild);
    };
    window.addEventListener('click', listener);
    return () => {
      window.removeEventListener('click', listener);
    };
  }, []);

  useEffect(() => {
    if (!isDropdownVisible) {
      setAllItemsShown(false);
      setFiltersVisible(false);
    }
  }, [isDropdownVisible]);

  const handleClickItem = useCallback(
    (item: Item) => {
      onSelectItem?.(item);
      setDropdownVisible(false);
      onSearch?.(undefined);
    },
    [onSelectItem, onSearch],
  );

  return (
    <div className={s.root} ref={rootRef}>
      <SearchBarField
        value={search}
        onChange={(newValue) => {
          setEnterPressed(false);
          onSearch?.(newValue);
        }}
        onEnter={(e) => {
          setEnterPressed(true);
          onEnter?.(e);
        }}
        isExpanded={isDropdownVisible}
        placeholder={placeholder}
        onToggleFilters={
          onChangeFilterParams != null
            ? () => {
                setFiltersVisible((prevState) => !prevState);
              }
            : undefined
        }
      />
      <div className={s.dropdown}>
        <div className={s.dropdownPosition}>
          {isDropdownVisible && (
            <SearchBarDropdown<FilterParams>
              key={'dropdown'}
              filters={filters}
              filterParams={filterParams}
              onChangeFilterParams={onChangeFilterParams}
              items={items}
              showFilters={isFiltersVisible}
              showAllItems={isAllItemsShown}
              onToggleShowAllItems={() => {
                setAllItemsShown((prevState) => !prevState);
              }}
              onSelectItem={handleClickItem}
              isEnterPressed={isEnterPressed}
              emptyState={props.emptyState}
            />
          )}
        </div>
      </div>
    </div>
  );
}
