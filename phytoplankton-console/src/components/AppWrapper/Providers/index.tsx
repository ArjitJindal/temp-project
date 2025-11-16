import React from 'react';
import AntConfigProvider from './AntConfigProvider';
import QueryClientProvider from './QueryClientProvider';
import SideBarProvider from './SidebarProvider';
import SettingsProviderMock from './mocks/SettingsProvider';
import ApiProviderMock from './mocks/ApiProvider';
import FlagrightUserProviderMock from './mocks/FlagrightUserProvider';
import StatementsProviderMock from './mocks/StatementsProvider';
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
export function StorybookMockProviders(props: Props) {
  return <StoryBookProviders>{props.children}</StoryBookProviders>;
}
