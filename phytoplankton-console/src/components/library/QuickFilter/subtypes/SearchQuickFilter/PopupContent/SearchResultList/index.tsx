import React from 'react';
import pluralize from 'pluralize';
import { List } from 'antd';
import { ItemType } from '../../types';
import s from './style.module.less';
import SearchResultItem from './SearchResultItem';
import { AsyncResource } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import type { PaginatedData } from '@/utils/queries/hooks';

export interface MessageRenderers {
  nothingFound: (search: string) => React.ReactNode;
  moreThan: (length: number) => React.ReactNode;
  foundCount: (length: number) => React.ReactNode;
}

interface Props<T> {
  selected: T[];
  onSelect: (item: T) => void;
  search: string;
  res: AsyncResource<PaginatedData<T>>;
  messageRenderers?: MessageRenderers;
  renderItem?: (item: T) => React.ReactNode;
}

const DEFAULT_MESSAGE_RENDERERS: MessageRenderers = {
  nothingFound: (search: string) => (
    <>
      We could not find an item with ID or name <b>{search}</b>
    </>
  ),
  moreThan: (length: number) => <>More than {length} items found</>,
  foundCount: (length: number) => <>{pluralize('item', length, true)} found</>,
};

export default function SearchResultList<T extends ItemType>(props: Props<T>) {
  const {
    res,
    selected,
    search,
    onSelect,
    messageRenderers = DEFAULT_MESSAGE_RENDERERS,
    renderItem,
  } = props;

  // todo: i18n
  return (
    <div className={s.root}>
      <div
        id="scrollableDiv"
        style={{
          maxHeight: 200,
          overflow: 'auto',
        }}
      >
        <AsyncResourceRenderer resource={res}>
          {({ items, total }) => (
            <>
              {renderMessage(items, total ?? items.length, search, messageRenderers)}
              {items.length > 0 && (
                <List<T>
                  dataSource={items}
                  renderItem={(item) => (
                    <SearchResultItem
                      item={item}
                      key={item.value}
                      isActive={selected.some((x) => x.value === item.value)}
                      onClick={() => {
                        onSelect(item);
                      }}
                      renderItem={renderItem}
                    />
                  )}
                />
              )}
            </>
          )}
        </AsyncResourceRenderer>
      </div>
    </div>
  );
}

function renderMessage<T extends ItemType>(
  items: T[],
  total: number,
  search: string,
  renderers: MessageRenderers,
) {
  const length = items.length;
  if (length === 0) {
    return <div className={s.nothingFound}>{renderers.nothingFound(search)}</div>;
  }
  if (total > length) {
    return <div className={s.subtitle}>{renderers.moreThan(length)}</div>;
  }
  return <div className={s.subtitle}>{renderers.foundCount(length)}</div>;
}
