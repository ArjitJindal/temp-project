import React from 'react';
import { PageContainerProps } from '@ant-design/pro-layout/lib/components/PageContainer';
import AuthProvider from './AuthProvider';
import SegmentProvider from './SegmentProvider';
import IdentityAnalitycs from './IdentityAnalitycs';
import { FlagrightUserProvider } from '@/utils/user-utils';
import { FeaturesProvider } from '@/components/AppWrapper/FeaturesProvider';
import { Feature } from '@/apis';

interface Props {
  pageContainerProps?: PageContainerProps;
  children?: React.ReactNode;
}

export default function AppWrapper(props: Props) {
  return (
    <AuthProvider>
      <FlagrightUserProvider>
        <FeaturesProvider globalFeatures={FEATURES_ENABLED as Feature[]}>
          <SegmentProvider writeKey={SEGMENT_WRITE_KEY}>
            <IdentityAnalitycs>{props.children}</IdentityAnalitycs>
          </SegmentProvider>
        </FeaturesProvider>
      </FlagrightUserProvider>
    </AuthProvider>
  );
}
