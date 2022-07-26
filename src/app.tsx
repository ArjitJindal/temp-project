import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { Navigate, Route, Routes } from 'react-router';
import AppWrapper from '@/components/AppWrapper';

import { useRoutes } from '@/services/routing';
import { isRedirect, isTree, RouteItem } from '@/services/routing/types';

import './global.less';

Sentry.init({
  dsn: SENTRY_DSN,
  release: `phytoplankton-console#${
    process.env.ENV_NAME === 'local' ? 'local' : process.env.GIT_HEAD_SHA
  }`,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 0.05,
  environment: process.env.ENV_NAME,
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

function App() {
  return (
    <AppWrapper>
      <Routing />
    </AppWrapper>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
