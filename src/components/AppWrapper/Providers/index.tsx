import React from 'react';
import SettingsProvider from './SettingsProvider';
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

export function StorybookMockProviders(props: Props) {
  return (
    <AntConfigProvider>
      <QueryClientProvider>
        <FlagrightUserProviderMock>
          <SettingsProviderMock>
            <SideBarProvider>{props.children}</SideBarProvider>
          </SettingsProviderMock>
        </FlagrightUserProviderMock>
      </QueryClientProvider>
    </AntConfigProvider>
  );
}

export default function Providers(props: Props) {
  return (
    <AntConfigProvider>
      <QueryClientProvider>
        <FlagrightUserProvider>
          <SettingsProvider globalFeatures={FEATURES_ENABLED as Feature[]}>
            <SideBarProvider>
              <MixPanelProvider>
                <DemoModeProvider>{props.children}</DemoModeProvider>
              </MixPanelProvider>
            </SideBarProvider>
          </SettingsProvider>
        </FlagrightUserProvider>
      </QueryClientProvider>
    </AntConfigProvider>
  );
}
