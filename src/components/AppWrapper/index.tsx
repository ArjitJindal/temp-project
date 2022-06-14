import React from 'react';
import { PageContainerProps } from '@ant-design/pro-layout/lib/components/PageContainer';
import AuthProvider from './AuthProvider';
import SegmentProvider from './SegmentProvider';
import IdentityAnalitycs from './IdentityAnalitycs';
import { FlagrightUserProvider } from '@/utils/user-utils';

interface Props {
  pageContainerProps?: PageContainerProps;
  children?: React.ReactNode;
}

export default function AppWrapper(props: Props) {
  return (
    <AuthProvider>
      <FlagrightUserProvider>
        <SegmentProvider writeKey={SEGMENT_WRITE_KEY}>
          <IdentityAnalitycs>{props.children}</IdentityAnalitycs>
        </SegmentProvider>
      </FlagrightUserProvider>
    </AuthProvider>
  );
}
