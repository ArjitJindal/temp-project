import * as Sentry from '@sentry/react';
import React, { Profiler, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Helmet } from 'react-helmet';
import Providers, { StorybookMockProviders } from './Providers';
import Menu from './Menu';
import s from './styles.module.less';
import ErrorBoundary from '@/components/utils/ErrorBoundary';
import StorybookPage from '@/pages/storybook';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';
import RouterProvider from '@/components/AppWrapper/Providers/RouterProvider';
import { getBranding } from '@/utils/branding';
import { useAuth0User } from '@/utils/user-utils';
import { recordRenderCommit } from '@/perf/sentryPerf';
import { useAtfReady } from '@/perf/useAtfReady';

interface Props {
  children?: React.ReactNode;
}

const branding = getBranding();

function MainContent(props: Props) {
  const [isCollapsed, setCollapsed] = useState(false);
  const [isDemoModeRes] = useDemoMode();

  const auth0User = useAuth0User();

  useEffect(() => {
    Sentry.setTags({
      userId: auth0User?.userId,
      email: auth0User?.verifiedEmail,
      tenantId: auth0User.tenantId,
      tenantName: auth0User.tenantName,
      companyName: branding.companyName,
      role: auth0User.role,
    });
  }, [auth0User]);

  return (
    <div className={`${s.root} ${isCollapsed && s.isCollapsed}`} data-cy={'AppWrapper'}>
      <Helmet>
        <link rel="icon" href={branding.faviconUrl} />
      </Helmet>
      {getOr(isDemoModeRes, true) && (
        <div className={s.demoMode}>
          <div>Demo mode</div>
        </div>
      )}
      <aside className={s.aside}>
        <Menu isCollapsed={isCollapsed} onChangeCollapsed={setCollapsed} />
      </aside>
      <main className={s.main}>
        <Profiler id="App" onRender={(_, __, actualDuration) => recordRenderCommit(actualDuration)}>
          <ErrorBoundary>
            <AtfGate>{props.children}</AtfGate>
          </ErrorBoundary>
        </Profiler>
      </main>
    </div>
  );
}

function AtfGate({ children }: { children?: React.ReactNode }) {
  useAtfReady();
  return <>{children}</>;
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
