import React, { useState } from 'react';
import cn from 'clsx';
import { useLocation } from 'react-router';
import { Helmet } from 'react-helmet';
import Providers, { StorybookMockProviders } from './Providers';
import Menu from './Menu';
import Header from './Header';
import s from './styles.module.less';
import ErrorBoundary from '@/components/ErrorBoundary';
import StorybookPage from '@/pages/storybook';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';
import RouterProvider from '@/components/AppWrapper/Providers/RouterProvider';
import { getBranding } from '@/utils/branding';

interface Props {
  children?: React.ReactNode;
}

const branding = getBranding();

function MainContent(props: Props) {
  const [isCollapsed, setCollapsed] = useState(false);
  const [isDemoModeRes] = useDemoMode();

  return (
    <div className={`${s.root} ${isCollapsed && s.isCollapsed}`}>
      <Helmet>
        <link rel="icon" href={branding.faviconUrl} />
      </Helmet>
      <Header className={cn(s.header, getOr(isDemoModeRes, true) && s.isDemoMode)} />
      <aside className={s.aside}>
        <Menu isCollapsed={isCollapsed} onChangeCollapsed={setCollapsed} />
      </aside>
      <main className={s.main}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </main>
    </div>
  );
}

function SpecialRoutes(props: Props) {
  const location = useLocation();

  if (location.pathname.startsWith('/storybook')) {
    return (
      <StorybookMockProviders>
        <StorybookPage />
      </StorybookMockProviders>
    );
  }

  return (
    <Providers>
      <ErrorBoundary>
        <MainContent {...props} />
      </ErrorBoundary>
    </Providers>
  );
}

export default function AppWrapper(props: Props) {
  return (
    <RouterProvider>
      <SpecialRoutes {...props} />
    </RouterProvider>
  );
}
