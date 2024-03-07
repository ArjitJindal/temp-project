import React from 'react';
import SettingsProvider from './SettingsProvider';
import AntConfigProvider from './AntConfigProvider';
import QueryClientProvider from './QueryClientProvider';
import SideBarProvider from './SidebarProvider';
import DemoModeProvider from './DemoModeProvider';
import FlagrightUserProvider from './FlagrightUserProvider';
import AuthProvider from './AuthProvider';
import SettingsProviderMock from './mocks/SettingsProvider';
import FlagrightUserProviderMock from './mocks/FlagrightUserProvider';
import { BrowserSupportProvider } from './BrowserSupportProvider';
import { SuperAdminModeProvider } from './SuperAdminModeProvider';
import CluesoTokenProvider from '@/components/AppWrapper/Providers/CluesoTokenProvider';

interface Props {
  children?: React.ReactNode;
}

// Define a higher-order component to compose the providers
const withProviders =
  (...components) =>
  ({ children }) =>
    components.reduceRight((acc, Comp) => <Comp>{acc}</Comp>, children);

const StoryBookProviders = withProviders(
  AntConfigProvider,
  QueryClientProvider,
  FlagrightUserProviderMock,
  SettingsProviderMock,
  SideBarProvider,
);
const AllProviders = withProviders(
  AuthProvider,
  AntConfigProvider,
  QueryClientProvider,
  FlagrightUserProvider,
  SettingsProvider,
  BrowserSupportProvider,
  SideBarProvider,
  DemoModeProvider,
  SuperAdminModeProvider,
  CluesoTokenProvider,
);
export function StorybookMockProviders(props: Props) {
  return <StoryBookProviders>{props.children}</StoryBookProviders>;
}

export default function Providers(props: Props) {
  return <AllProviders>{props.children}</AllProviders>;
}
