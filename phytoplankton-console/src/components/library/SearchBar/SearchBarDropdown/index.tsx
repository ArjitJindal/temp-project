import React from 'react';
import { EmptyEntitiesInfo } from '../../EmptyDataInfo';
import { SearchBarProps } from '..';
import s from './index.module.less';
import ExpandContainer from '@/components/library/ExpandContainer';
import { FilterProps } from '@/components/library/Filter/types';
import Filter from '@/components/library/Filter';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { AsyncResource, getOr, isLoading } from '@/utils/asyncResource';

export interface Item {
  itemId: string;
  itemName: string;
  itemDescription: string;
}

export interface ItemGroup {
  title: string;
  items: Item[];
}

interface Props<FilterParams> {
  filters?: FilterProps<FilterParams>[];
  filterParams?: FilterParams;
  onChangeFilterParams?: (filterParams: FilterParams) => void;
  onSelectItem?: (item: Item) => void;
  items: AsyncResource<ItemGroup[]>;
  showFilters?: boolean;
  showAllItems?: boolean;
  collapsedMaxLength?: number;
  onToggleShowAllItems?: () => void;
  isEnterPressed?: boolean;
  emptyState?: SearchBarProps<FilterParams>['emptyState'];
}

export default function SearchBarDropdown<FilterParams extends object = object>(
  props: Props<FilterParams>,
) {
  const {
    items,
    filterParams,
    onChangeFilterParams,
    filters,
    showFilters,
    showAllItems,
    onToggleShowAllItems,
    collapsedMaxLength = 3,
    onSelectItem,
    isEnterPressed,
    emptyState,
  } = props;
  const totalAmount = getOr(items, []).reduce((acc, x) => acc + x.items.length, 0);

  return isEnterPressed && totalAmount === 0 && emptyState && !isLoading(items) ? (
    <EmptyEntitiesInfo
      action={emptyState.actionLabel}
      onActionButtonClick={emptyState.onAction}
      title={emptyState.title}
      description={emptyState.description}
      showIcon={true}
      showButtonIcon={false}
    />
  ) : (
    <div className={s.root}>
      {filters && filterParams != null && onChangeFilterParams && filters.length > 0 && (
        <ExpandContainer isCollapsed={!showFilters}>
          <div className={s.filters}>
            {filters.map((filter) => (
              <Filter<FilterParams>
                key={filter.key}
                filter={filter}
                params={filterParams}
                onChangeParams={onChangeFilterParams}
              />
            ))}
          </div>
        </ExpandContainer>
      )}
      <AsyncResourceRenderer resource={items}>
        {(items) =>
          items.map(({ title, items: groupItems }) => (
            <React.Fragment key={title}>
              <div className={s.subheader}>
                {title} ({groupItems.length})
              </div>
              <div className={s.items}>
                {(showAllItems ? groupItems : groupItems.slice(0, collapsedMaxLength)).map(
                  (item) => (
                    <div
                      key={item.itemId}
                      className={s.item}
                      onClick={() => {
                        onSelectItem?.(item);
                      }}
                    >
                      <div className={s.itemId}>{item.itemId}</div>
                      <div className={s.itemName}>{item.itemName}</div>
                      <div className={s.itemDescription}>{item.itemDescription}</div>
                    </div>
                  ),
                )}
              </div>
            </React.Fragment>
          ))
        }
      </AsyncResourceRenderer>
      {totalAmount > collapsedMaxLength && !showAllItems && (
        <button
          className={s.seeAllButton}
          onClick={(e) => {
            e.stopPropagation();
            onToggleShowAllItems?.();
          }}
        >
          See all results ({totalAmount})
        </button>
      )}
    </div>
  );
}
