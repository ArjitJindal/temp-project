import React from 'react';
import AuthProvider from './AuthProvider';
import { SettingsProvider } from './SettingsProvider';
import RouterProvider from './RouterProvider';
import AntConfigProvider from './AntConfigProvider';
import QueryClientProvider from './QueryClientProvider';
import MixPanelProvider from './MixPanelProvider';
import SideBarProvider from './SidebarProvider';
import DemoModeProvider from './DemoModeProvider';
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
                  <MixPanelProvider>
                    <DemoModeProvider>{props.children}</DemoModeProvider>
                  </MixPanelProvider>
                </SideBarProvider>
              </QueryClientProvider>
            </RouterProvider>
          </SettingsProvider>
        </FlagrightUserProvider>
      </AuthProvider>
    </AntConfigProvider>
  );
}
