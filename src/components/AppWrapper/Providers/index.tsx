import React from 'react';
import AuthProvider from './AuthProvider';
import { SettingsProvider } from './SettingsProvider';
import RouterProvider from './RouterProvider';
import AntConfigProvider from './AntConfigProvider';
import QueryClientProvider from './QueryClientProvider';
import MixPanelProvider from './MixPanelProvider';
import SideBarProvider from './SidebarProvider';
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
          <SettingsProvider globalFeatures={FEATURES_ENABLED as Feature[]}>
            <RouterProvider>
              <QueryClientProvider>
                <SideBarProvider>
                  <MixPanelProvider>{props.children}</MixPanelProvider>
                </SideBarProvider>
              </QueryClientProvider>
            </RouterProvider>
          </SettingsProvider>
        </FlagrightUserProvider>
      </AuthProvider>
    </AntConfigProvider>
  );
}
