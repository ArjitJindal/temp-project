import React from 'react';
import Alert from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Error">
        <Alert type="error">
          You need to select at least one transaction direction of any party for the rule to run.
        </Alert>
      </UseCase>
      <UseCase title="Warning">
        <Alert type="warning">
          You have selected an already configured risk level. Clicking on ‘Apply’ will override the
          older configuration
        </Alert>
      </UseCase>
      <UseCase title="Info">
        <Alert type="info">
          You have selected an already configured risk level. Clicking on ‘Apply’ will override the
          older configuration
        </Alert>
      </UseCase>
    </>
  );
}
