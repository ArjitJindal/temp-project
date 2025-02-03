import React from 'react';
import Alert from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Statuses and sizes">
        <PropertyMatrix xLabel="type" x={['ERROR', 'WARNING', 'INFO', 'SUCCESS'] as const}>
          {(type) => <Alert type={type}>Short text</Alert>}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="Long text">
        <Alert type={'INFO'}>
          You need to select at least one transaction direction of any party for the rule to run.
          You need to select at least one transaction direction of any party for the rule to run.
          You need to select at least one transaction direction of any party for the rule to run.
          You need to select at least one transaction direction of any party for the rule to run.
          You need to select at least one transaction direction of any party for the rule to run.
        </Alert>
      </UseCase>
    </>
  );
}
