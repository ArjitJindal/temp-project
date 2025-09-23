import { useEffect } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { markAtfReady } from './sentryPerf';

/**
 * ATF = Above The Fold
 * Measures time until critical, first-screen data is ready to render.
 * We start an ATF span in routeStarted() and close it in markAtfReady(),
 * recording the duration as the 'atf_fetch_ms' measurement.
 */

export function useAtfReady(): void {
  const fetching = useIsFetching({ predicate: (q) => q.meta?.atf === true });
  useEffect(() => {
    if (fetching === 0) {
      markAtfReady();
    }
  }, [fetching]);
}
