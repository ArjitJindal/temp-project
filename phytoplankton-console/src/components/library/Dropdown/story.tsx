import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Basic'}>
        <Component
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          onSelect={(option) => {
            alert(option.label);
          }}
        >
          <div>Test</div>
        </Component>
      </UseCase>
    </>
  );
}
