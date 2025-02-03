import React, { useState } from 'react';
import { CloseMessage, message, MessageBody } from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [closeFunction, setCloseFunction] = useState<CloseMessage | null>(null);
  return (
    <>
      <UseCase title="Notification body">
        <PropertyMatrix
          y={['INFO', 'SUCCESS', 'ERROR', 'LOADING', 'WARNING'] as const}
          yLabel={'type'}
          x={[true, false]}
          xLabel={'long text'}
        >
          {(x, y) => (
            <MessageBody
              type={y}
              title={
                x
                  ? 'Very long, long, long, long, long, long, long, long, long, long, long,' +
                    ' long, long, long, long, long, long, long, long, long, long, long, long,' +
                    ` long, long, long, long title of type ${y}`
                  : `Title of type ${y}`
              }
              link={'https://google.com'}
              linkTitle={'Link text'}
            >
              {x
                ? 'Very long, long, long, long, long, long, long, long, long, long, long,' +
                  ' long, long, long, long, long, long, long, long, long, long, long, long,' +
                  ' long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                  ' long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                  ' long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                  ' long, long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                  ' long, long, long, long, long, long, long, long, long, long, long, long, long, longss,' +
                  ' long, long, long, long, long, long, long, long, long, long, long, long, long, long,' +
                  ` long, long, long, long, long, long, long, long text of type ${y}`
                : `Message of type ${y}`}
            </MessageBody>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="Title only">
        <PropertyMatrix
          y={['INFO', 'SUCCESS', 'ERROR', 'LOADING', 'WARNING'] as const}
          yLabel={'type'}
          x={[true, false]}
          xLabel={'long text'}
        >
          {(x, y) => (
            <MessageBody
              type={y}
              title={
                x
                  ? 'Very long, long, long, long, long, long, long, long, long, long, long,' +
                    ' long, long, long, long, long, long, long, long, long, long, long, long,' +
                    ` long, long, long, long title of type ${y}`
                  : `Title of type ${y}`
              }
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="With link">
        <MessageBody
          type={'INFO'}
          title={`Sample message title`}
          link={'https://google.com'}
          linkTitle={'Link text'}
        >
          {'Sample message body, it could be much longer'}
        </MessageBody>
      </UseCase>
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
