import { useState, useEffect, useRef, useCallback } from 'react';
import cn from 'classnames';
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
  emptyState?: {
    title: string;
    description: string;
    onAction?: () => void;
    actionLabel?: string;
  };
  showEmptyState?: () => boolean;
  moreFilters?: FilterProps<FilterParams>[];
  onClear: () => void;
  onAISearch?: (search: string) => void;
  showTitleOnSingleItem?: boolean;
  isAIEnabled?: boolean;
  setIsAIEnabled?: (isAIEnabled: boolean) => void;
  variant?: 'default' | 'minimal';
  onBlur?: () => void;
}

export default function SearchBar<FilterParams extends object = object>(
  props: SearchBarProps<FilterParams>,
) {
  const {
    search,
    onSearch,
    onSelectItem,
    emptyState,
    showEmptyState,
    moreFilters,
    onClear,
    items,
    filters,
    onChangeFilterParams,
    filterParams,
    placeholder,
    onAISearch,
    showTitleOnSingleItem = true,
    isAIEnabled,
    setIsAIEnabled,
    onBlur,
    variant = 'default',
  } = props;

  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isFiltersVisible, setFiltersVisible] = useState(false);
  const [isAllItemsShown, setAllItemsShown] = useState(false);
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
      onSearch?.(item.itemName);
    },
    [onSelectItem, onSearch],
  );

  return (
    <div className={s.root} ref={rootRef}>
      <SearchBarField
        value={search}
        onChange={onSearch}
        onEnter={(e) => {
          if (isAIEnabled) {
            setFiltersVisible(true);
            onAISearch?.(e.currentTarget.value);
          }
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
        filterParams={filterParams}
        filters={filters}
        onClear={() => {
          onClear();
          setFiltersVisible(false);
        }}
        isAIEnabled={isAIEnabled}
        setIsAIEnabled={setIsAIEnabled}
        onChangeFilterParams={onChangeFilterParams}
        variant={variant}
        onBlur={onBlur}
      />
      <div className={s.dropdown}>
        <div className={cn(s.dropdownPosition, variant === 'minimal' && s.minimalDropdownPosition)}>
          {isDropdownVisible && (
            <SearchBarDropdown<FilterParams>
              key={'dropdown'}
              filters={filters}
              moreFilters={moreFilters}
              filterParams={filterParams}
              onChangeFilterParams={onChangeFilterParams}
              items={items}
              search={search}
              showFilters={isFiltersVisible}
              showAllItems={isAllItemsShown}
              onToggleShowAllItems={() => {
                setAllItemsShown((prevState) => !prevState);
              }}
              onSelectItem={handleClickItem}
              emptyState={emptyState}
              showEmptyState={showEmptyState}
              isAIEnabled={isAIEnabled}
              setIsAIEnabled={setIsAIEnabled}
              onAISearch={(search) => {
                onAISearch?.(search);
                setFiltersVisible(true);
              }}
              showTitleOnSingleItem={showTitleOnSingleItem}
              variant={variant}
            />
          )}
        </div>
      </div>
    </div>
  );
}
