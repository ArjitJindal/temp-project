import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/browser';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { Debug } from '@sentry/integrations';
import { FetchCallError } from './apis';
import AppWrapper from '@/components/AppWrapper';

import { useRoutes } from '@/services/routing';
import { isRedirect, isTree, RouteItem } from '@/services/routing/types';

import './global.less';
import { getBranding } from '@/utils/branding';
import { makeUrl } from '@/utils/routing';

interface HttpError {
  code?: number;
  body?: string;
  headers?:
    | {
        [key: string]: string;
      }
    | undefined;
  httpMessage?: string;
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
  enabled: !['local', 'dev:user'].includes(process.env.ENV_NAME ?? ''),
  beforeSend(event, hint) {
    const error = hint?.originalException as HttpError | Error;
    if (error && 'code' in error && error.code && error.code >= 400 && error.code < 500) {
      return null;
    }
    if (error instanceof FetchCallError) {
      // These errors happen ofter when running cypress, because of it's internal
      // architecture, so ignoring them
      if (event.tags?.['tenantId'] === 'cypress-tenant') {
        return null;
      }
      event.extra = {
        ...error.request,
      };
    }
    // Some requests are not made using generated API, so they are not wrapped in FetchCallError.
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      if (event.tags?.['tenantId'] === 'cypress-tenant') {
        return null;
      }
    }
    return event;
  },
});

function renderRoutes(routes: RouteItem[]) {
  return routes.map((route) => (
    <React.Fragment key={route.path}>
      {isTree(route) ? renderRoutes(route.routes) : null}
      {isRedirect(route) ? (
        <Route path={route.path} element={<RedirectWithParams to={route.redirect} />} />
      ) : (
        <Route
          path={route.path}
          element={'component' in route ? React.createElement(route.component) : <></>}
        />
      )}
    </React.Fragment>
  ));
}

function RedirectWithParams(props: { to: string }) {
  const { to } = props;
  const params = useParams();
  return <Navigate to={makeUrl(to, params)} replace />;
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
