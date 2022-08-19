import React, { ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import { Alert } from 'antd';
import { FallbackRender } from '@sentry/react/types/errorboundary';

interface Props {
  children: React.ReactNode;
}

const Fallback: FallbackRender = (errorData) => {
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
  return <Sentry.ErrorBoundary fallback={Fallback}>{props.children}</Sentry.ErrorBoundary>;
}
