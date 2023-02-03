import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [value, setValue] = useState<number>();
  const [value2, setValue2] = useState<number>();
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
      <UseCase title={'Sizes'}>
        <Component
          placeholder={'Default size'}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
        <Component
          size="LARGE"
          placeholder={'Large size'}
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
      <UseCase title={'Min and max value'}>
        <Component
          placeholder={'From 0 to 5'}
          value={value2}
          onChange={(newValue) => {
            setValue2(newValue);
          }}
          min={0}
          max={5}
        />
      </UseCase>
    </>
  );
}
