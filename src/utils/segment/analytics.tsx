import { AnalyticsBrowser } from '@segment/analytics-next';
import { Analytics, Event } from '@/utils/segment/types';

export function makeSegmentAnalytics(segmentAnalytics: AnalyticsBrowser): Analytics {
  return {
    identify(userId: string) {
      segmentAnalytics.identify(userId);
    },
    group(groupId: string) {
      segmentAnalytics.group(groupId);
    },
    page: () => {
      segmentAnalytics.page(undefined);
    },
    event: (event: Event) => {
      const { title, ...rest } = event;
      segmentAnalytics.track(title, rest);
    },
  };
}
