import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [value, setValue] = useState<string | undefined>();
  return (
    <>
      <UseCase title={'Basic case'}>
        <Component
          placeholder={'Placeholder example'}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Large size'}>
        <Component
          size="LARGE"
          placeholder={'Placeholder example'}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Disabled'}>
        <Component
          isDisabled={true}
          placeholder={'Placeholder example'}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Error'}>
        <Component
          isError={true}
          placeholder={'Placeholder example'}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Clearable'}>
        <Component
          allowClear={true}
          placeholder={'Placeholder example'}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
    </>
  );
}
