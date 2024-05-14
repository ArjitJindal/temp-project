import React from 'react';
import Alert from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Statuses and sizes">
        <PropertyMatrix
          xLabel="type"
          x={['error', 'warning', 'info'] as const}
          yLabel="size"
          y={['s', 'm', 'l'] as const}
        >
          {(type, size) => (
            <Alert type={type} size={size}>
              Short text
            </Alert>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title="Long text">
        <PropertyMatrix yLabel="size" y={['s', 'm', 'l'] as const}>
          {(_, size) => (
            <Alert type={'info'} size={size}>
              You need to select at least one transaction direction of any party for the rule to
              run. You need to select at least one transaction direction of any party for the rule
              to run. You need to select at least one transaction direction of any party for the
              rule to run. You need to select at least one transaction direction of any party for
              the rule to run. You need to select at least one transaction direction of any party
              for the rule to run.
            </Alert>
          )}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
