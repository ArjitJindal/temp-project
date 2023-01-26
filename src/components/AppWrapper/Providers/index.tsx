import React from 'react';
import AuthProvider from './AuthProvider';
import SettingsProvider from './SettingsProvider';
import RouterProvider from './RouterProvider';
import AntConfigProvider from './AntConfigProvider';
import QueryClientProvider from './QueryClientProvider';
import MixPanelProvider from './MixPanelProvider';
import SideBarProvider from './SidebarProvider';
import DemoModeProvider from './DemoModeProvider';
import FlagrightUserProvider from './FlagrightUserProvider';
import { Feature } from '@/apis';
import SettingsProviderMock from '@/components/AppWrapper/Providers/mocks/SettingsProvider';
import FlagrightUserProviderMock from '@/components/AppWrapper/Providers/mocks/FlagrightUserProvider';

interface Props {
  children?: React.ReactNode;
}

export function LocalOnlyProviders(props: Props) {
  return (
    <AntConfigProvider>
      <FlagrightUserProviderMock>
        <SettingsProviderMock>
          <RouterProvider>
            <SideBarProvider>{props.children}</SideBarProvider>
          </RouterProvider>
        </SettingsProviderMock>
      </FlagrightUserProviderMock>
    </AntConfigProvider>
  );
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
