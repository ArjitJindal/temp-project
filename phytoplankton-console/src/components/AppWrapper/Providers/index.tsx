import React from 'react';
import SettingsProvider from './SettingsProvider';
import AntConfigProvider from './AntConfigProvider';
import QueryClientProvider from './QueryClientProvider';
import SideBarProvider from './SidebarProvider';
import DemoModeProvider from './DemoModeProvider';
import FlagrightUserProvider from './FlagrightUserProvider';
import AuthProvider from './AuthProvider';
import SettingsProviderMock from './mocks/SettingsProvider';
import ApiProviderMock from './mocks/ApiProvider';
import FlagrightUserProviderMock from './mocks/FlagrightUserProvider';
import { BrowserSupportProvider } from './BrowserSupportProvider';
import { SuperAdminModeProvider } from './SuperAdminModeProvider';
import { PostHogProviderWrapper } from './PostHogProvider';
import SessionTimeoutProvider from './SessionTimeoutDetector';
import ActiveSessionProvider from './ActiveSessionsProvider';
import StatementsProviderMock from './mocks/StatementsProvider';
import CluesoTokenProvider from './CluesoTokenProvider';
import ApiProvider from '@/components/AppWrapper/Providers/ApiProvider';
import ToastsProvider from '@/components/AppWrapper/Providers/ToastsProvider';

interface Props {
  children?: React.ReactNode;
}

// Define a higher-order component to compose the providers
const withProviders =
  (...components) =>
  ({ children }) =>
    components.reduceRight((acc, Comp) => <Comp>{acc}</Comp>, children);

const StoryBookProviders = withProviders(
  ToastsProvider,
  ApiProviderMock,
  AntConfigProvider,
  QueryClientProvider,
  FlagrightUserProviderMock,
  StatementsProviderMock,
  SettingsProviderMock,
  SideBarProvider,
);
const AllProviders = withProviders(
  AuthProvider,
  ToastsProvider,
  AntConfigProvider,
  QueryClientProvider,
  FlagrightUserProvider,
  ApiProvider,
  ActiveSessionProvider,
  SettingsProvider,
  SessionTimeoutProvider,
  PostHogProviderWrapper,
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
