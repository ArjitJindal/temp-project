import React, { useState } from 'react';
import { CloseMessage, message } from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';

export default function (): JSX.Element {
  const [closeFunction, setCloseFunction] = useState<CloseMessage | null>(null);
  return (
    <>
      <UseCase title="Different types">
        <Button
          onClick={() => {
            message.success('Success message');
          }}
        >
          Success
        </Button>
        <Button
          onClick={() => {
            message.error('Error message');
          }}
        >
          Error
        </Button>
        <Button
          onClick={() => {
            message.warn('Warning message');
          }}
        >
          Warning
        </Button>
      </UseCase>
      <UseCase title="Long text">
        <Button
          onClick={() => {
            message.success(
              'Very long, long, long, long, long, long, long, long, long, long, long,' +
                ' long, long, long, long, long, long, long, long, long, long, long, long,' +
                ' long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                ' long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                ' long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                ' long, long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                ' long, long, long, long, long, long, long, long, long, long, long, long, long, longss,' +
                ' long, long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                ' long, long, long, long, long, long, long, long text',
            );
          }}
        >
          Show
        </Button>
      </UseCase>
      <UseCase title="Loading">
        <Button
          onClick={() => {
            setCloseFunction(() => message.loading('Some message here...'));
          }}
        >
          Show
        </Button>
        <Button
          isDisabled={closeFunction == null}
          onClick={() => {
            if (closeFunction != null) {
              closeFunction();
            }
          }}
        >
          Close
        </Button>
      </UseCase>
    </>
  );
}
