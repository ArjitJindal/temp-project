import React from 'react';
import AuthProvider from './AuthProvider';
import SegmentProvider from './SegmentProvider';
import IdentityAnalitycs from './IdentityAnalitycs';
import { FeaturesProvider } from './FeaturesProvider';
import RouterProvider from './RouterProvider';
import AntConfigProvider from './AntConfigProvider';
import { FlagrightUserProvider } from '@/utils/user-utils';
import { Feature } from '@/apis';

interface Props {
  children?: React.ReactNode;
}

export default function Providers(props: Props) {
  return (
    <AntConfigProvider>
      <AuthProvider>
        <FlagrightUserProvider>
          <FeaturesProvider globalFeatures={FEATURES_ENABLED as Feature[]}>
            <SegmentProvider writeKey={SEGMENT_WRITE_KEY}>
              <RouterProvider>
                <IdentityAnalitycs>{props.children}</IdentityAnalitycs>
              </RouterProvider>
            </SegmentProvider>
          </FeaturesProvider>
        </FlagrightUserProvider>
      </AuthProvider>
    </AntConfigProvider>
  );
}
