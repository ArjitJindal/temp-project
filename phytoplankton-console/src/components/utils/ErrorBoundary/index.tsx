import React, { useMemo, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { Alert } from 'antd';
import { FallbackRender } from '@sentry/react/types/errorboundary';
import { useLocation } from 'react-router';
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

export default function ErrorBoundary(props: Props) {
  const location = useLocation();
  const errorStateRef = useRef<{ hasError: boolean; errorLocation: string | null }>({
    hasError: false,
    errorLocation: null,
  });

  const resetKey = useMemo(() => {
    if (
      errorStateRef.current.hasError &&
      errorStateRef.current.errorLocation !== location.pathname
    ) {
      errorStateRef.current.hasError = false;
      errorStateRef.current.errorLocation = null;
      return `reset-${Date.now()}`;
    }
    return 'stable';
  }, [location.pathname]);

  return (
    <Sentry.ErrorBoundary
      key={resetKey}
      fallback={(errorData) => {
        errorStateRef.current.hasError = true;
        errorStateRef.current.errorLocation = location.pathname;
        return Fallback(errorData);
      }}
      beforeCapture={(_, error) => {
        if (error instanceof NotFoundError) {
          return false;
        }
      }}
    >
      {props.children}
    </Sentry.ErrorBoundary>
  );
}
