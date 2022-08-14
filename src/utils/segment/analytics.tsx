import { AnalyticsBrowser } from '@segment/analytics-next';
import { Analytics, Event } from '@/utils/segment/types';

export function makeSegmentAnalytics(segmentAnalytics: AnalyticsBrowser): Analytics {
  return {
    identify(userId: string, user) {
      segmentAnalytics.identify(userId, user);
    },
    tenant(groupId: string, traits) {
      segmentAnalytics.group(groupId, traits);
    },
    page: (category: string, properties) => {
      segmentAnalytics.page(category, properties);
    },
    event: (event: Event) => {
      const { title, ...rest } = event;
      segmentAnalytics.track(title, rest);
    },
  };
}
