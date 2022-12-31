import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { useIsFetching } from '@tanstack/react-query';
import { useMixPanelTracker } from './mixpanel';

export function usePageViewTimeTracker() {
  const { pathname } = useLocation();
  const mixPanelTracker = useMixPanelTracker();

  useEffect(() => {
    let time = 0;
    const interval = setInterval(() => {
      time += 1;
    }, 1000);

    return () => {
      mixPanelTracker('Page View Time', {
        path: pathname,
        'Time Spent': time,
        unit: 'seconds',
      });
      clearInterval(interval);
    };
  }, [mixPanelTracker, pathname]);
}

export function usePageTimeLoadTracker() {
  const time = useMemo(() => Date.now(), []);
  const { pathname } = useLocation();
  const isQueriesFetching = useIsFetching();
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [isFetched, setIsFetched] = useState(false);
  const mixPanelTracker = useMixPanelTracker();

  useEffect(() => {
    if (!isQueriesFetching && !isFirstTime && !isFetched) {
      mixPanelTracker('Page Load Time (Page Wrapper)', {
        'Load Time': Date.now() - time,
        path: pathname,
        unit: 'milliseconds',
      });
      setIsFetched(true);
    } else {
      setIsFirstTime(false);
    }
  }, [isQueriesFetching, isFirstTime, isFetched, mixPanelTracker, pathname, time]);
}

export function useButtonTracker() {
  const mixPanelTracker = useMixPanelTracker();

  const trackButtonClick = (buttonName: string, data?: object) => {
    mixPanelTracker('Button Click', {
      'Button Name': buttonName,
      ...data,
    });
  };

  return trackButtonClick;
}

export const useApiTime = () => {
  const mixPanelTracker = useMixPanelTracker();
  async function measureTime<T>(body: () => Promise<T>, name: string): Promise<T> {
    const a = performance.now();
    const result = await body();
    const b = performance.now();
    mixPanelTracker('API Time Elapsed', {
      'API Name': name,
      'Time Elapsed': b - a,
      unit: 'milliseconds',
    });
    return result;
  }

  return measureTime;
};

export const usePageViewTracker = (name: string) => {
  const mixPanelTracker = useMixPanelTracker();
  const { pathname } = useLocation();

  useEffect(() => {
    mixPanelTracker('Page View', {
      'Page Name': name,
      path: pathname,
    });
  }, [mixPanelTracker, name, pathname]);
};
