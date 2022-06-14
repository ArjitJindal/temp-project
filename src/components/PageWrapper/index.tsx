import React, { useEffect } from 'react';
import { PageContainerProps } from '@ant-design/pro-layout/lib/components/PageContainer';
import { useRouteMatch } from 'react-router';
import AntConfigProvider from './AntConfigProvider';
import AntPageComponent from './AntPageComponent';
import { useAnalytics } from '@/utils/segment/context';
import { useAuth0User } from '@/utils/user-utils';

interface Props {
  pageContainerProps?: PageContainerProps;
  children?: React.ReactNode;
}

export default function PageWrapper(props: Props) {
  const user = useAuth0User();
  const analytics = useAnalytics();
  const location = useRouteMatch();

  const userId = user.userId;
  const tenantId = user.tenantId;

  useEffect(() => {
    analytics.page({
      url: location.url,
    });
  }, [analytics, tenantId, location.url]);

  return (
    <AntConfigProvider>
      <AntPageComponent {...props.pageContainerProps}>{props.children}</AntPageComponent>
    </AntConfigProvider>
  );
}
