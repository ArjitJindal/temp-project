import React, { useState } from 'react';
import cn from 'clsx';
import { Navigate, useLocation } from 'react-router';
import Providers, { StorybookMockProviders } from './Providers';
import Menu from './Menu';
import Header from './Header';
import s from './styles.module.less';
import ErrorBoundary from '@/components/ErrorBoundary';
import StorybookPage from '@/pages/storybook';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';
import LoginPage from '@/pages/login';
import LogoutPage from '@/pages/logout';
import AuthProvider, { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';
import RouterProvider from '@/components/AppWrapper/Providers/RouterProvider';

interface Props {
  children?: React.ReactNode;
}

function MainContent(props: Props) {
  const [isCollapsed, setCollapsed] = useState(false);
  const [isDemoModeRes] = useDemoMode();

  return (
    <div className={`${s.root} ${isCollapsed && s.isCollapsed}`}>
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
  const { accessToken } = useAuth();
  const location = useLocation();

  if (location.pathname.startsWith('/storybook')) {
    return (
      <StorybookMockProviders>
        <StorybookPage />
      </StorybookMockProviders>
    );
  }

  if (location.pathname.startsWith('/login')) {
    return <LoginPage />;
  }

  if (location.pathname.startsWith('/logout')) {
    return <LogoutPage />;
  }

  if (accessToken == null) {
    return <Navigate to={'/login'} />;
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
      <AuthProvider>
        <SpecialRoutes {...props} />
      </AuthProvider>
    </RouterProvider>
  );
}
