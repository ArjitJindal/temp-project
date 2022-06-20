import React, { useContext, useEffect, useState } from 'react';
import { makeSegmentAnalytics } from '@/utils/segment/analytics';
import { Analytics } from '@/utils/segment/types';

const Context = React.createContext<{ analytics: Analytics } | null>(null);

interface Props {
  writeKey: string;
  children: React.ReactNode;
}

export function SegmentContextProvider(props: Props): JSX.Element {
  const [analytics, setAnalytics] = useState<Analytics>({
    identify: () => {
      console.warn('[identify] This is a stub analytics function, analytics can be blocked');
    },
    tenant: () => {
      console.warn('[tenant] This is a stub analytics function, analytics can be blocked');
    },
    page: () => {
      console.warn('[page] This is a stub analytics function, analytics can be blocked');
    },
    event: () => {
      console.warn('[event] This is a stub analytics function, analytics can be blocked');
    },
  });
  /*
    This is a temporal solution, we should remove it after we get rid of UmiJS.
    We should be able to use AnalyticsBrowser from '@segment/analytics-next' module directly,
    but UmiJS fails to resolve async imports, which this module uses. So, for now we use old-style
    analytics connection (see also document.ejs and globals.d.ts)
   */
  useEffect(() => {
    let isCanceled = false;
    window.analytics.ready(() => {
      if (isCanceled) {
        return;
      }
      setAnalytics(makeSegmentAnalytics(window.analytics));
    });
    return () => {
      isCanceled = true;
    };
  }, []);
  // todo: enable this when we get rid of umijs
  // const analytics = useMemo(() => {
  //    const analyticsBrowser = AnalyticsBrowser.load({
  //      writeKey: props.writeKey,
  //    });
  //   return makeSegmentAnalytics(analyticsBrowser);
  // }, [props.writeKey]);
  return <Context.Provider value={{ analytics }}> {props.children}</Context.Provider>;
}

export function useAnalytics(): Analytics {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Segment context provider is not properly initialized`);
  }
  return context.analytics;
}
