import { PostHog } from 'posthog-js';
import { isEmpty } from 'lodash';
import { FlagrightAuth0User, isFlagrightInternalUser } from './user-utils';

export const postHogClient = new PostHog();
export const internalPostHogClient = new PostHog();

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
    (process.env.ENV_NAME as string).includes('dev') ||
    isFlagrightInternalUser(auth0User)
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

export const identifyUser = (client: PostHog, auth0User: FlagrightAuth0User) => {
  postHogClient.identify(
    auth0User.userId,
    {
      name: auth0User.name,
      email: auth0User.verifiedEmail,
      auth0Id: auth0User.userId,
      role: auth0User.role,
      tenantId: auth0User.tenantId,
      tenantName: auth0User.tenantName,
      region: auth0User.region,
      tenantConsoleApiUrl: auth0User.tenantConsoleApiUrl,
      demoMode: auth0User.demoMode,
    },
    {
      // One time properties (useful for tracking user properties that change over time)
      $role: auth0User.role,
      $demoMode: auth0User.demoMode,
    },
  );
};
