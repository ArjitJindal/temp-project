import { PostHog } from 'posthog-js';
import { isEmpty } from 'lodash';
import { FlagrightAuth0User } from './user-utils';

export const postHogClient = new PostHog();

export const EVENTS = {
  TAB_CLICK: 'tab_click',
};

export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
  postHogClient.capture(eventName, properties);
};

export const isAutoCaptureDisabled = (auth0User: FlagrightAuth0User) => {
  return (
    auth0User.tenantName.includes('Cypress') ||
    process.env.ENV_NAME === 'local' ||
    (process.env.ENV_NAME as string).includes('dev')
  );
};

export const captureTabEvent = (
  tab: string | undefined,
  oldTab: string,
  tabs: { key: string; captureEvents?: boolean }[],
  eventData?: Record<string, any>,
) => {
  if (eventData && !isEmpty(eventData) && oldTab !== tab) {
    const tabItem = tabs.find((item) => item.key === tab);
    if (tabItem?.captureEvents) {
      captureEvent(EVENTS.TAB_CLICK, {
        ...eventData,
        tab,
        oldTab,
      });
    }

    return;
  }
};
