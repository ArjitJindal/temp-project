import { useIsFetching } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useMixPanelTracker } from '@/utils/mixpanel';

interface Props {
  children: React.ReactNode;
}

export const MixPanelProvider = (props: Props) => {
  const isFetching = useIsFetching();
  const [firstLoad, setFirstLoad] = useState(true);
  const mixPanelTracker = useMixPanelTracker();

  useEffect(() => {
    if (isFetching === 0 && firstLoad) {
      const timeToLoad = performance.now();

      mixPanelTracker('First Page Load Time', {
        'Load Time': timeToLoad,
        page: window.location.pathname,
        queryString: window.location.search,
        firstLoad: true,
      });

      setFirstLoad(false);
    }
  }, [isFetching, firstLoad, mixPanelTracker]);

  return <>{props.children}</>;
};

export default MixPanelProvider;
