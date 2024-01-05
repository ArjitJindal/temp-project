import React from 'react';
import s from './index.module.less';
import ExpandContainer from '@/components/library/ExpandContainer';
import { FilterProps } from '@/components/library/Filter/types';
import Filter from '@/components/library/Filter';

export interface Item {
  ruleNumber: string;
  ruleName: string;
  ruleDescription: string;
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
  items: ItemGroup[];
  showFilters?: boolean;
  showAllItems?: boolean;
  collapsedMaxLength?: number;
  onToggleShowAllItems?: () => void;
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
  } = props;
  const totalAmount = items.reduce((acc, x) => acc + x.items.length, 0);

  return (
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
      {items.map(({ title, items }) => (
        <React.Fragment key={title}>
          <div className={s.subheader}>
            {title} ({items.length})
          </div>
          <div className={s.items}>
            {(showAllItems ? items : items.slice(0, collapsedMaxLength)).map((item) => (
              <div
                key={item.ruleNumber}
                className={s.item}
                onClick={() => {
                  onSelectItem?.(item);
                }}
              >
                <div className={s.itemRuleNumber}>{item.ruleNumber}</div>
                <div className={s.itemRuleName}>{item.ruleName}</div>
                <div className={s.itemRuleDescription}>{item.ruleDescription}</div>
              </div>
            ))}
          </div>
        </React.Fragment>
      ))}
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
