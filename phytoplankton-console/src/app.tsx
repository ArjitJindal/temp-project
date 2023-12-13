import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/browser';
import { Navigate, Route, Routes } from 'react-router';
import { Debug } from '@sentry/integrations';
import AppWrapper from '@/components/AppWrapper';

import { useRoutes } from '@/services/routing';
import { isRedirect, isTree, RouteItem } from '@/services/routing/types';

import './global.less';
import { getBranding } from '@/utils/branding';

interface Error {
  cause: unknown;
  status: number;
  statusCode: number;
  expose: boolean;
  headers?:
    | {
        [key: string]: string;
      }
    | undefined;
  [key: string]: any;
}

Sentry.init({
  dsn: SENTRY_DSN,
  release: process.env.RELEASE,
  integrations: [new BrowserTracing(), new Debug(), new Sentry.Replay()],
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  tracesSampleRate: 0.05,
  environment: process.env.ENV_NAME,
  enabled: process.env.ENV_NAME !== 'local',
  beforeSend(event, hint) {
    const error = hint?.originalException as Error;
    if (error && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return null;
    }
    return event;
  },
});

function renderRoutes(routes: RouteItem[]) {
  return routes.map((route) => (
    <React.Fragment key={route.path}>
      {isTree(route) ? renderRoutes(route.routes) : null}
      {isRedirect(route) ? (
        <Route path={route.path} element={<Navigate to={route.redirect} replace />} />
      ) : (
        <Route
          path={route.path}
          element={'component' in route ? React.createElement(route.component) : <></>}
        />
      )}
    </React.Fragment>
  ));
}

function Routing() {
  const routes = useRoutes();
  return <Routes>{renderRoutes(routes)}</Routes>;
}

const branding = getBranding();

function App() {
  useEffect(() => {
    document.title = `${branding.companyName} Console`;
  }, []);

  return (
    <AppWrapper>
      <Routing />
    </AppWrapper>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
