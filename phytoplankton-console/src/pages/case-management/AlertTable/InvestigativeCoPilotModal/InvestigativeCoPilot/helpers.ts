import { Dispatch, useState, useCallback, useMemo } from 'react';
import { Updater } from '@/utils/state';
import { scrollTo } from '@/utils/browser';
import {
  QuestionResponse,
  QuestionResponseSkeleton,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';

export function useScrollState(rootEl: HTMLElement | null): [
  {
    scrollPosition: number;
    isScrollVisible: boolean;
    isScrollEventDisabled: boolean;
    isBottom: boolean;
  },
  {
    refresh: () => void;
    scroll: (direction: 'BOTTOM' | 'TOP', smooth: boolean) => void;
    setIsBottom: Dispatch<Updater<boolean>>;
    setScrollEventDisabled: Dispatch<Updater<boolean>>;
  },
] {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrollVisible, setScrollVisible] = useState(false);
  const [isBottom, setIsBottom] = useState(true);
  const [isScrollEventDisabled, setScrollEventDisabled] = useState(false);

  const handleRefresh = useCallback(() => {
    if (rootEl) {
      const isScrollVisible = calcIsScrollVisible(rootEl);
      const position = calcScrollPosition(rootEl);
      const isBottom = Math.abs(position) < 10;
      setIsBottom(isBottom);
      setScrollPosition(position);
      setScrollVisible(isScrollVisible);
    }
  }, [rootEl]);

  const handleScroll = useCallback(
    (direction: 'BOTTOM' | 'TOP', smooth: boolean) => {
      if (rootEl) {
        setIsBottom(direction === 'BOTTOM');
        const top = direction === 'BOTTOM' ? rootEl.scrollHeight - rootEl.clientHeight : 0;
        if (smooth) {
          setScrollEventDisabled(true);
        }
        scrollTo(
          rootEl,
          {
            top,
            smooth,
          },
          () => {
            setScrollEventDisabled(false);
            handleRefresh();
          },
        );
      }
    },
    [rootEl, handleRefresh],
  );

  return useMemo(() => {
    const state = { scrollPosition, isScrollVisible, isBottom, isScrollEventDisabled };
    const handlers = {
      refresh: handleRefresh,
      setIsBottom,
      setScrollEventDisabled,
      scroll: handleScroll,
    };
    return [state, handlers];
  }, [
    scrollPosition,
    isScrollVisible,
    isBottom,
    isScrollEventDisabled,
    handleRefresh,
    handleScroll,
  ]);
}

export function calcScrollPosition(element: Element) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function calcIsScrollVisible(element: Element) {
  return element.scrollHeight > element.clientHeight;
}

export function itemId(item: QuestionResponse | QuestionResponseSkeleton): string {
  if (item.questionType === 'SKELETON') {
    return item.requestId;
  }
  return item.createdAt.toString();
}
