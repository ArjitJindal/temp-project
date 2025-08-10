import React, { useMemo, useState } from 'react';
import cn from 'clsx';
import { EmptyEntitiesInfo } from '../../EmptyDataInfo';
import { SearchBarProps } from '..';
import Spinner from '../../Spinner';
import s from './index.module.less';
import ExpandContainer from '@/components/utils/ExpandContainer';
import { FilterProps } from '@/components/library/Filter/types';
import Filter from '@/components/library/Filter';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { AsyncResource, getOr } from '@/utils/asyncResource';
import { H5, H6 } from '@/components/ui/Typography';
import COLORS from '@/components/ui/colors';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import { getBranding } from '@/utils/branding';

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
  emptyState?: SearchBarProps<FilterParams>['emptyState'];
  moreFilters?: FilterProps<FilterParams>[];
  showEmptyState?: () => boolean;
  isAIEnabled?: boolean;
  setIsAIEnabled?: (isAIEnabled: boolean) => void;
  search?: string;
  onAISearch?: (search: string) => void;
  showTitleOnSingleItem?: boolean;
  variant?: 'default' | 'minimal';
}

const AskAI = (props: { onClick: () => void }) => {
  return (
    <div
      className={s.aiSection}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
    >
      <AiForensicsLogo />
      <H5 bold>Ask {getBranding().companyName} AI</H5>
    </div>
  );
};

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
    emptyState,
    moreFilters,
    showEmptyState,
    isAIEnabled,
    setIsAIEnabled,
    search,
    onAISearch,
    showTitleOnSingleItem,
    variant,
  } = props;

  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const totalAmount = useMemo(
    () => getOr(items, []).reduce((acc, { items }) => acc + items.length, 0),
    [items],
  );

  return showEmptyState?.() && emptyState ? (
    <div className={s.rootEmpty}>
      {!isAIEnabled && setIsAIEnabled && search && (
        <AskAI
          onClick={() => {
            setIsAIEnabled(true);
            onAISearch?.(search);
          }}
        />
      )}
      <EmptyEntitiesInfo
        action={emptyState.actionLabel}
        onActionButtonClick={emptyState.onAction}
        title={emptyState.title}
        description={emptyState.description}
        showIcon={true}
        showButtonIcon={false}
      />
    </div>
  ) : (
    <div className={s.root}>
      {filters &&
        filterParams != null &&
        onChangeFilterParams &&
        filters.length > 0 &&
        variant !== 'minimal' && (
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
              {moreFilters?.length && showMoreFilters
                ? moreFilters.map((filter) => (
                    <Filter<FilterParams>
                      key={filter.key}
                      filter={filter}
                      params={filterParams}
                      onChangeParams={onChangeFilterParams}
                    />
                  ))
                : null}

              {moreFilters?.length && !showMoreFilters ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreFilters(true);
                  }}
                >
                  <H6 style={{ color: COLORS.brandBlue.base, cursor: 'pointer' }} bold>
                    More filters
                  </H6>
                </div>
              ) : null}
            </div>
          </ExpandContainer>
        )}
      {!isAIEnabled && setIsAIEnabled && search ? (
        <div style={{ marginTop: showFilters ? 8 : 16, marginBottom: 8 }}>
          <AskAI
            onClick={() => {
              setIsAIEnabled(true);
              onAISearch?.(search);
            }}
          />
        </div>
      ) : null}

      <AsyncResourceRenderer
        resource={items}
        renderLoading={() => (
          <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
            <Spinner />
          </div>
        )}
      >
        {(items) =>
          items.map(({ title, items: groupItems }) => (
            <React.Fragment key={title}>
              {(showTitleOnSingleItem || items.length > 1) &&
              groupItems.length > 0 &&
              variant !== 'minimal' ? (
                <div className={s.subheader}>
                  {title} ({groupItems.length})
                </div>
              ) : null}
              <div className={s.items}>
                {(showAllItems || variant === 'minimal'
                  ? groupItems
                  : groupItems.slice(0, collapsedMaxLength)
                ).map((item) => (
                  <div
                    key={item.itemId}
                    className={cn(s.item, variant === 'minimal' && s.minimalItem)}
                    onClick={() => {
                      onSelectItem?.(item);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                  >
                    {variant !== 'minimal' && <div className={s.itemId}>{item.itemId}</div>}
                    <div className={cn(s.itemName, variant === 'minimal' && s.minimalItemName)}>
                      {item.itemName}
                    </div>
                    <div className={s.itemDescription}>{item.itemDescription}</div>
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))
        }
      </AsyncResourceRenderer>
      {totalAmount > collapsedMaxLength && !showAllItems && variant !== 'minimal' && (
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
