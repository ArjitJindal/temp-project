import mixpanel from 'mixpanel-browser';
import {
  browserName,
  deviceType,
  browserVersion,
  osName,
  mobileModel,
  mobileVendor,
} from 'react-device-detect';
import { useLocation } from 'react-router';
import { useAuth0User } from './user-utils';

mixpanel.init(MIXPANEL_TOKEN, { debug: true });

export const mixPanel = mixpanel;

export const useMixPanelTracker = () => {
  const user = useAuth0User();
  const { pathname, search } = useLocation();

  const trackEvent = async (eventName: string, data: object) => {
    if (process.env.ENV_NAME === 'local') {
      return;
    }
    const ipData: Promise<any> = await fetch('https://ipinfo.io/json').then((res) => res.json());

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
  };

  return trackEvent;
};
