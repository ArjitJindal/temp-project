import { AnalyticsBrowser } from '@segment/analytics-next';
import { Analytics, Event } from '@/utils/segment/types';

export function makeSegmentAnalytics(segmentAnalytics: AnalyticsBrowser): Analytics {
  return {
    identify(userId: string) {
      segmentAnalytics.identify(userId);
    },
    tenant(groupId: string, traits) {
      segmentAnalytics.group(groupId, traits);
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
