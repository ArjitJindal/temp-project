// import React, { useMemo, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { Alert } from 'antd';
import { FallbackRender } from '@sentry/react/types/errorboundary';
// import { useLocation } from 'react-router';
import { NotFoundError } from '@/utils/errors';
import NoFoundPage from '@/pages/404';

interface Props {
  children: React.ReactNode;
}
const Fallback: FallbackRender = (errorData) => {
  if (errorData.error instanceof NotFoundError) {
    return <NoFoundPage />;
  }
  return (
    <Alert
      style={{
        margin: '1rem',
      }}
      type="error"
      description={
        <>
          <p>
            <b>Sorry, an error has occurred. {errorData.error.message ?? 'Unknown error'}</b>
          </p>
          {process.env.NODE_ENV === 'development' ? (
            <>
              <p>
                <b>Event ID: {errorData.eventId}</b>
              </p>
              <p>
                <button onClick={errorData.resetError}>Reset error state</button>
              </p>
              <p>
                <b>Error stack:</b>
              </p>
              <pre
                style={{
                  background: '#ffffff69',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {errorData.componentStack}
              </pre>
            </>
          ) : (
            <p>
              Our team has been made aware of this error. It will be fixed soon. Sorry for the
              inconvenience!
            </p>
          )}
        </>
      }
    />
  );
};

function ErrorBoundaryWithLocationReset(props: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={Fallback}
      beforeCapture={(scope, error) => {
        // Don't send 404 errors to Sentry as they're user behavior, not bugs
        if (error instanceof NotFoundError) {
          return false;
        }
      }}
    >
      {props.children}
    </Sentry.ErrorBoundary>
  );
}

export default function ErrorBoundary(props: Props) {
  // const location = useLocation();
  // const previousLocationRef = useRef<string>();

  // // Generate a new key whenever the pathname changes
  // const resetKey = useMemo(() => {
  //   const currentLocation = location.pathname;
  //   if (previousLocationRef.current !== currentLocation) {
  //     previousLocationRef.current = currentLocation;
  //     return Date.now();
  //   }
  //   return previousLocationRef.current || currentLocation;
  // }, [location.pathname]);

  return <ErrorBoundaryWithLocationReset>{props.children}</ErrorBoundaryWithLocationReset>;
}
