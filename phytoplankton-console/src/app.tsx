import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/browser';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { Debug } from '@sentry/integrations';
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
  integrations: [
    new BrowserTracing(),
    new Debug(),
    new Sentry.Replay({
      block: ['.sentry-block, [data-sentry-block=true]'],
      unblock: ['.sentry-unblock, [data-sentry-allow=true], [data-sentry-unblock=true]'],
      unmask: ['.sentry-unmask, [data-sentry-allow=true], [data-sentry-unmask=true]'],
    }),
  ],
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  tracesSampleRate: 0.2,
  environment: process.env.ENV_NAME,
  enabled: !['local', 'dev:user'].includes(process.env.ENV_NAME ?? ''),
  beforeSend(event, hint) {
    const originalException = hint.originalException;
    // This specific issue is caused by the MetaMask browser extension, in future we could add more specific rules
    if (
      originalException != null &&
      typeof originalException === 'object' &&
      !(originalException instanceof Error)
    ) {
      const asRecord = originalException as Record<string, unknown>;
      if (asRecord.code === 4001 && asRecord.message === 'wallet must has at least one account') {
        return null;
      }
    }

    // Errors of these types are most probably caused by Outlook 365 scanning
    // emails for links and crawl link targets, so we could ignoring them
    // details: https://github.com/getsentry/sentry-javascript/issues/3440#issuecomment-865857552
    if (
      typeof hint.originalException === 'string' &&
      /Object Not Found Matching Id:.+, MethodName:.+, ParamCount:.+/.test(hint.originalException)
    ) {
      return null;
    }

    if (!(hint?.originalException instanceof Error)) {
      return event;
    }

    if (hint?.originalException.message.includes('ResizeObserver loop limit exceeded')) {
      return null;
    }

    if (hint?.originalException.message.includes('ResizeObserver loop limit exceeded')) {
      return null;
    }

    const error = hint?.originalException as HttpError | Error;
    if (error && 'code' in error && error.code && error.code >= 400 && error.code < 500) {
      return null;
    }
    if (error && 'request' in error) {
      // These errors happen ofter when running cypress, because of it's internal
      // architecture, so ignoring them
      if (event.tags?.['tenantId'] === 'cypress-tenant') {
        return null;
      }
      event.extra = {
        ...error.request,
        cause: error.cause,
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
