import React, { useRef, useCallback, useMemo, Dispatch } from 'react';
import { QuestionResponse, QuestionResponseSkeleton } from '../types';
import s from './index.module.less';
import EmptyIcon from './empty.react.svg';
import HistoryItem from './HistoryItem';
import { GAP, DATA_KEY } from './helpers';
import HistoryItemSkeleton from './HistoryItemSkeleton';
import { Updater } from '@/utils/state';
import { itemId } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/helpers';

interface Props {
  alertId: string;
  items: (QuestionResponse | QuestionResponseSkeleton)[];
  seenItems: string[];
  setSizes: Dispatch<Updater<{ [key: string]: number }>>;
}

export default function History(props: Props) {
  const { alertId, items, seenItems, setSizes } = props;

  const rootRef = useRef<HTMLDivElement>(null);

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
        .map((item) =>
          item.questionType === 'SKELETON' ? (
            <HistoryItemSkeleton key={itemId(item)} item={item} />
          ) : (
            <HistoryItem
              key={itemId(item)}
              isUnread={!seenItems.includes(itemId(item))}
              alertId={alertId}
              item={item}
              observe={observe}
            />
          ),
        )}
    </div>
  );
}
