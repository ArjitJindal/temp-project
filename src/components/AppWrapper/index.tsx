import React from 'react';
import { PageContainerProps } from '@ant-design/pro-layout/lib/components/PageContainer';
import AuthProvider from './AuthProvider';
import ZoneRedirect from './ZoneRedirect';

interface Props {
  pageContainerProps?: PageContainerProps;
  children?: React.ReactNode;
}

export default function AppWrapper(props: Props) {
  return (
    <AuthProvider>
      <ZoneRedirect>{props.children}</ZoneRedirect>
    </AuthProvider>
  );
}
