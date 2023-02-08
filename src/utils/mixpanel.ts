import mixpanel from 'mixpanel-browser';
import {
  browserName,
  deviceType,
  browserVersion,
  osName,
  mobileModel,
  mobileVendor,
} from 'react-device-detect';
import { useCallback } from 'react';
import { useAuth0User } from './user-utils';

let ipData: any = undefined;

mixpanel.init(MIXPANEL_TOKEN, { debug: true });

export const mixPanel = mixpanel;

export const useMixPanelTracker = () => {
  const user = useAuth0User();
  const { pathname, search } = window.location;

  const trackEvent = useCallback(
    async (eventName: string, data: object) => {
      if (process.env.ENV_NAME === 'local') {
        return;
      }
      if (!ipData) {
        try {
          ipData = await fetch('https://ipinfo.io/json').then((res) => res.json());
        } catch (e) {
          // ignore
        }
      }

      mixpanel.track(eventName, {
        ...data,
        ...user,
        ...ipData,
        browserName,
        deviceType,
        browserVersion,
        osName,
        mobileModel,
        mobileVendor,
        Environment: process.env.ENV_NAME,
        Platform: 'Console',
        query: search,
        path: pathname,
      });
    },
    [user, pathname, search],
  );

  return trackEvent;
};
