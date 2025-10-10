import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';

export default function (): JSX.Element {
  const [active, setActive] = useState(0);
  const steps = [
    {
      key: 'first_item',
      title: 'Basic details',
      description: 'Configure the basic details for this rule',
      isUnfilled: true,
    },
    {
      key: 'second_item',
      title: 'Standard filters',
      description:
        'Configure filters that are applicable to all rules. This decription can be quite long',
      isOptional: true,
    },
    {
      key: 'third_item',
      title: 'Third step',
      description: 'This step is invalid',
      isOptional: true,
      isInvalid: true,
    },
    {
      key: 'last_item',
      title: 'Last step',
      description: 'Some short description here',
      isOptional: true,
    },
  ];
  return (
    <>
      <UseCase title={'Basic case'}>
        <Component
          steps={steps}
          active={steps[active].key}
          onChange={(newActive) => setActive(steps.findIndex((step) => step.key === newActive))}
        />
        <br />
        <Button onClick={() => setActive((active) => (active + 1) % steps.length)}>
          Change step
        </Button>
      </UseCase>
      <UseCase title={'Vertical mode'}>
        <Component
          layout={'VERTICAL'}
          steps={steps}
          active={steps[active].key}
          onChange={(newActive) => setActive(steps.findIndex((step) => step.key === newActive))}
        />
        <br />
        <Button onClick={() => setActive((active) => (active + 1) % steps.length)}>
          Change step
        </Button>
      </UseCase>
      <UseCase title={'Disabled step'}>
        <Component
          steps={[
            ...steps,
            {
              key: 'disabled_step',
              title: 'Disabled step',
              description: 'This step is disabled',
              isDisabled: true,
            },
          ]}
          active={steps[active].key}
          onChange={(newActive) => setActive(steps.findIndex((step) => step.key === newActive))}
        />
      </UseCase>
    </>
  );
}
