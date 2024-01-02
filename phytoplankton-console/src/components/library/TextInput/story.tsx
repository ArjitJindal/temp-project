import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [value, setValue] = useState<string | undefined>('input value');
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
        <PropertyMatrix x={[false, true]} xLabel="Disabled">
          {(isDisabled) => (
            <Component
              isError={true}
              isDisabled={isDisabled}
              placeholder={'Placeholder example'}
              value={value}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
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
