import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [values, setValues] = useState<string[] | undefined>([]);
  return (
    <>
      <UseCase title={'Modes'}>
        <Component
          placeholder={'Single select'}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
        <Component
          mode="MULTIPLE"
          placeholder={'Multiple select'}
          options={[
            { value: 'option1', label: 'Option #1' },
            { value: 'option2', label: 'Option #2 with a very, very, very long title' },
            { value: 'option3', label: 'Option #3' },
            { value: 'option4', label: 'Option #4' },
            { value: 'option5', label: 'Option #5' },
            { value: 'option6', label: 'Option #6' },
            { value: 'option7', label: 'Option #7' },
            { value: 'option8', label: 'Option #8' },
            { value: 'option9', label: 'Option #9' },
          ]}
          value={values}
          onChange={(newValue) => {
            setValues(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Disabled'}>
        <Component
          isDisabled={true}
          placeholder={'Single input'}
          value={value}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
        <Component
          mode="MULTIPLE"
          isDisabled={true}
          placeholder={'Multiple input'}
          value={values}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          onChange={(newValue) => {
            setValues(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Sizes'}>
        <Component
          placeholder={'Default size'}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
        <Component
          size="SMALL"
          placeholder={'Small size'}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
        <Component
          mode="MULTIPLE"
          size="SMALL"
          placeholder={'Small size, multi select'}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          value={values}
          onChange={(newValue) => {
            setValues(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Error'}>
        <Component
          isError={true}
          placeholder={'Single select'}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
        <Component
          isError={true}
          mode="MULTIPLE"
          placeholder={'Multiple select'}
          options={[
            { value: 'option1', label: 'First option' },
            { value: 'option2', label: 'Second option' },
          ]}
          value={values}
          onChange={(newValue) => {
            setValues(newValue);
          }}
        />
      </UseCase>
    </>
  );
}
