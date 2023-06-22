import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [value, setValue] = useState<undefined | boolean>(false);
  return (
    <>
      <UseCase title={'Basic case'} description="Checkbox input element itself, without label">
        <Component
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Disabled'}>
        <Component value={value} onChange={setValue} isDisabled={true} />
      </UseCase>
      <UseCase
        title={'Undetermined'}
        description="Checkbox is in indeterminate state when receives undefined"
      >
        <Component value={undefined} onChange={() => {}} />
      </UseCase>
      <UseCase title={'With label'}>
        <Component value={value} onChange={setValue} label={'Label text'} />
      </UseCase>
    </>
  );
}
