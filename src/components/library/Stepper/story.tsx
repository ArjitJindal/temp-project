import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/ui/Button';

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
        'Configure filters that are common for all the rules. This decription can be quite long',
      isOptional: true,
    },
    {
      key: 'third_item',
      title: 'Last step',
      description: 'Some short description here',
      isOptional: true,
    },
  ];
  return (
    <UseCase title={'Basic case'}>
      <Component steps={steps} active={steps[active].key} />
      <br />
      <Button onClick={() => setActive((active) => (active + 1) % steps.length)}>
        Change step
      </Button>
    </UseCase>
  );
}
