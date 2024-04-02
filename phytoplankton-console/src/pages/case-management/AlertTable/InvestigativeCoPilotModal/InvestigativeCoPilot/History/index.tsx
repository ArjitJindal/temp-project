import React, { useRef, useCallback, useMemo, useLayoutEffect, useState } from 'react';
import { QuestionResponse } from '../types';
import s from './index.module.less';
import EmptyIcon from './empty.react.svg';
import HistoryItem from './HistoryItem';
import { calcVisibleElements, GAP, DATA_KEY } from './helpers';

interface Props {
  scrollPosition: number;
  alertId: string;
  items: QuestionResponse[];
  visibleItems: string[];
  onShowItems: (ids: string[]) => void;
}

export default function History(props: Props) {
  const { alertId, items, scrollPosition, visibleItems, onShowItems } = props;

  const rootRef = useRef<HTMLDivElement>(null);

  const [sizes, setSizes] = useState<{ [key: string]: number }>({});
  const itemIds = useMemo(() => {
    return items.map((x) => x.createdAt.toString());
  }, [items]);

  const observer = useMemo(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const patch = {};
      for (const entry of entries) {
        const key = entry.target.getAttribute(DATA_KEY)?.toString() ?? 'null';
        patch[key] = entry.borderBoxSize[0].blockSize;
      }
      setSizes((prevState) => ({ ...prevState, ...patch }));
    });
    return resizeObserver;
  }, [setSizes]);

  const observe = useCallback(
    (el: Element) => {
      const key = el.getAttribute(DATA_KEY)?.toString() ?? 'null';
      setSizes((prevState) => ({ ...prevState, [key]: el.getBoundingClientRect().height }));
      observer.observe(el);
      return () => observer.unobserve(el);
    },
    [observer, setSizes],
  );

  useLayoutEffect(() => {
    onShowItems(calcVisibleElements(itemIds, sizes, scrollPosition));
  }, [itemIds, sizes, scrollPosition, onShowItems]);

  return (
    <div className={s.root} style={{ gap: GAP }} ref={rootRef}>
      {items.length === 0 && (
        <div className={s.empty}>
          <EmptyIcon height={120} width={120} />
          {'Start your investigation by searching for required data from below'}
        </div>
      )}
      {items
        .filter((item) => Boolean(item))
        .map((item) => (
          <HistoryItem
            isVisible={visibleItems.includes(item.createdAt.toString())}
            key={item.createdAt}
            alertId={alertId}
            item={item}
            observe={observe}
          />
        ))}
    </div>
  );
}
