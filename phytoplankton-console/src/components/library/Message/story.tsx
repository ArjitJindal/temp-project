import React, { useState } from 'react';
import { CloseMessage, message } from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';

export default function (): JSX.Element {
  const [closeFunction, setCloseFunction] = useState<CloseMessage | null>(null);
  return (
    <>
      <UseCase title="Basic message types">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            onClick={() => {
              message.info(`Info message (${new Date().toISOString()})`);
            }}
          >
            Info Message
          </Button>
          <Button
            onClick={() => {
              message.success(`Success message (${new Date().toISOString()})`);
            }}
          >
            Success Message
          </Button>
          <Button
            onClick={() => {
              message.warn(`Warning message (${new Date().toISOString()})`);
            }}
          >
            Warning Message
          </Button>
          <Button
            onClick={() => {
              message.error(`Error message (${new Date().toISOString()})`);
            }}
          >
            Error Message
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Basic message types with default positioning (top-right) and standard durations
        </p>
      </UseCase>

      <UseCase title="Loading messages">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            isDisabled={closeFunction != null}
            onClick={() => {
              setCloseFunction(() => message.loading('Processing your request...'));
            }}
          >
            Show Loading
          </Button>
          <Button
            isDisabled={closeFunction == null}
            onClick={() => {
              if (closeFunction != null) {
                closeFunction();
                setCloseFunction(null);
              }
            }}
          >
            Close Loading
          </Button>
          <Button
            onClick={() => {
              const close = message.loading('Processing...');
              setTimeout(() => {
                close();
                message.success('Operation completed successfully!');
              }, 2000);
            }}
          >
            Loading → Success (2s)
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Loading messages appear at top-center, don't auto-dismiss, and must be manually closed
        </p>
      </UseCase>

      <UseCase title="Messages with details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            onClick={() => {
              message.info('System update available', {
                details: 'Version 2.1.4 includes performance improvements and bug fixes.',
              });
            }}
          >
            Info with Details
          </Button>
          <Button
            onClick={() => {
              message.success('Data imported successfully', {
                details: '1,245 records were processed and added to your database.',
              });
            }}
          >
            Success with Details
          </Button>
          <Button
            onClick={() => {
              message.warn('Storage limit approaching', {
                details: 'You have used 85% of your storage quota. Consider upgrading your plan.',
              });
            }}
          >
            Warning with Details
          </Button>
          <Button
            onClick={() => {
              message.error('Validation failed', {
                details:
                  'Please check the following fields: email format, password strength, and phone number.',
              });
            }}
          >
            Error with Details
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Messages with additional detail text for more context
        </p>
      </UseCase>

      <UseCase title="Messages with clickable links">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            onClick={() => {
              message.info('Documentation updated', {
                details: 'New API documentation is now available.',
                link: 'https://docs.example.com/api',
                linkTitle: 'View Documentation',
                copyFeedback: 'Documentation URL copied to clipboard',
              });
            }}
          >
            Info with Link
          </Button>
          <Button
            onClick={() => {
              message.success('Case created successfully', {
                details: 'Your case has been created and assigned ID #12345.',
                link: 'https://example.com/cases/12345',
                linkTitle: 'View Case',
                copyFeedback: 'Case URL copied to clipboard',
              });
            }}
          >
            Success with Link
          </Button>
          <Button
            onClick={() => {
              message.warn('Action required', {
                details: 'Please review and approve the pending transactions.',
                link: 'https://example.com/transactions/pending',
                linkTitle: 'Review Transactions',
                copyFeedback: 'Transactions URL copied to clipboard',
              });
            }}
          >
            Warning with Link
          </Button>
          <Button
            onClick={() => {
              message.error('Error occurred', {
                details: 'An unexpected error occurred. Please contact support if this persists.',
                link: 'https://support.example.com/error/500',
                linkTitle: 'Get Support',
                copyFeedback: 'Support URL copied to clipboard',
              });
            }}
          >
            Error with Link
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Messages with links appear at bottom-right position with extended duration (18 seconds)
        </p>
      </UseCase>

      <UseCase title="Custom positioning">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            onClick={() => {
              message.info('Top Center notification', {
                position: 'top-center',
              });
            }}
          >
            Top Center
          </Button>
          <Button
            onClick={() => {
              message.success('Top Left notification', {
                position: 'top-left',
              });
            }}
          >
            Top Left
          </Button>
          <Button
            onClick={() => {
              message.warn('Bottom Left notification', {
                position: 'bottom-left',
              });
            }}
          >
            Bottom Left
          </Button>
          <Button
            onClick={() => {
              message.error('Bottom Center notification', {
                position: 'bottom-center',
              });
            }}
          >
            Bottom Center
          </Button>
          <Button
            onClick={() => {
              message.error('Bottom Right notification', {
                position: 'bottom-right',
              });
            }}
          >
            Bottom Right
          </Button>
          <Button
            onClick={() => {
              message.error('Top Right notification', {
                position: 'top-right',
              });
            }}
          >
            Top Right
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Override default positioning with custom positions
        </p>
      </UseCase>

      <UseCase title="Custom duration">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            onClick={() => {
              message.info('Quick notification', {
                duration: 1000,
              });
            }}
          >
            Quick (1 second)
          </Button>
          <Button
            onClick={() => {
              message.success('Standard notification', {
                duration: 3000,
              });
            }}
          >
            Standard (3 seconds)
          </Button>
          <Button
            onClick={() => {
              message.warn('Extended notification', {
                duration: 8000,
              });
            }}
          >
            Extended (8 seconds)
          </Button>
          <Button
            onClick={() => {
              message.error('Persistent notification', {
                duration: 0,
              });
            }}
          >
            Persistent (No auto-dismiss)
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Custom duration controls how long messages stay visible
        </p>
      </UseCase>

      <UseCase title="Long text handling">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            onClick={() => {
              message.success(
                'Very long success message with extensive details about the operation that was completed successfully and all the related information that users might need to know about this particular action and its consequences for their workflow and data processing pipeline.',
              );
            }}
          >
            Long Title
          </Button>
          <Button
            onClick={() => {
              message.error('Operation failed', {
                details:
                  'A detailed explanation of what went wrong during the operation including specific error codes, affected systems, recommended recovery steps, and additional troubleshooting information that might be helpful for resolving this issue and preventing similar problems in the future.',
              });
            }}
          >
            Long Details
          </Button>
          <Button
            onClick={() => {
              message.info(
                'Comprehensive system notification with detailed information about multiple aspects of the current operation status and related system health metrics',
                {
                  details:
                    'Additional contextual information providing further details about the system state, performance metrics, and recommendations for optimal usage patterns and best practices.',
                  link: 'https://docs.example.com/comprehensive-guide-to-system-optimization-and-best-practices',
                  linkTitle: 'Complete Documentation',
                },
              );
            }}
          >
            Long Everything
          </Button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          How the component handles long text content
        </p>
      </UseCase>
    </>
  );
}
