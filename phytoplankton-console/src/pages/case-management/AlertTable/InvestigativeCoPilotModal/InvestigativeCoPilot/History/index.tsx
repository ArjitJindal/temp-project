import { useRef, useCallback, useMemo, Dispatch } from 'react';
import { omitBy } from 'lodash';
import { QuestionResponse, QuestionResponseSkeleton } from '../types';
import s from './index.module.less';
import EmptyIcon from './empty.react.svg';
import HistoryItem from './HistoryItem';
import { GAP, DATA_KEY } from './helpers';
import HistoryItemSkeleton from './HistoryItemSkeleton';
import { Updater, applyUpdater } from '@/utils/state';
import { itemId } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/helpers';
import { useDeepEqualMemo } from '@/utils/hooks';

type Sizes = { [key: string]: number };

interface Props {
  alertId: string;
  items: (QuestionResponse | QuestionResponseSkeleton)[];
  seenItems: string[];
  setSizes: Dispatch<Updater<Sizes>>;
}

export default function History(props: Props) {
  const { alertId, items, seenItems, setSizes } = props;

  const allIds = useMemo(() => items.map((item) => itemId(item)), [items]);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleSetSizes = useDeepEqualMemo(() => {
    return (updater: Updater<Sizes>) => {
      setSizes((prevState: Sizes): Sizes => {
        return omitBy(applyUpdater(prevState, updater), (_, key) => !allIds.includes(key));
      });
    };
  }, [setSizes, allIds]);

  const observer = useDeepEqualMemo(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const patch: Sizes = {};
      for (const entry of entries) {
        const key = entry.target.getAttribute(DATA_KEY)?.toString() ?? 'null';
        patch[key] = entry.borderBoxSize[0].blockSize;
      }
      handleSetSizes((prevState) => ({ ...prevState, ...patch }));
    });
    return resizeObserver;
  }, [handleSetSizes]);

  const observe = useCallback(
    (el: Element) => {
      const key = el.getAttribute(DATA_KEY)?.toString() ?? 'null';
      handleSetSizes((prevState) => ({ ...prevState, [key]: el.getBoundingClientRect().height }));
      observer.observe(el);
      return () => observer.unobserve(el);
    },
    [observer, handleSetSizes],
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
