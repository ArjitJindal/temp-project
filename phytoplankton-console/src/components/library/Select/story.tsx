import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Modes'}>
        {([state, setState]) => (
          <>
            <Component
              placeholder={'Single select'}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              value={state.value1}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value1: newValue }));
              }}
              tooltip
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
              value={state.value2}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value2: newValue }));
              }}
            />
            <Component
              mode="TAGS"
              placeholder={'Tags select'}
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
              value={state.value3}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value3: newValue }));
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase title={'Disabled'}>
        {([state, setState]) => (
          <>
            <Component
              isDisabled={true}
              placeholder={'Single input'}
              value={state.value}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
            />
            <Component
              mode="MULTIPLE"
              isDisabled={true}
              placeholder={'Multiple input'}
              value={state.values}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, values: newValue }));
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase title={'Sizes'}>
        {([state, setState]) => (
          <>
            <Component
              placeholder={'Default size'}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
            />
            <Component
              size="LARGE"
              placeholder={'Large size'}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
            />
            <Component
              mode="MULTIPLE"
              size="DEFAULT"
              placeholder={'Default size, multi select'}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              value={state.values}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, values: newValue }));
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase title={'Error'}>
        {([state, setState]) => (
          <>
            <Component
              isError={true}
              placeholder={'Single select'}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
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
              value={state.values}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, values: newValue }));
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase title={'Copyable'}>
        {([state, setState]) => (
          <>
            <Component
              isCopyable={true}
              placeholder={'Single select'}
              options={[
                { value: 'option1', label: 'First option' },
                { value: 'option2', label: 'Second option' },
              ]}
              value={state.value1}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value1: newValue }));
              }}
            />
            <Component
              isCopyable={true}
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
              value={state.value2}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value2: newValue }));
              }}
              tooltip
            />
            <Component
              isCopyable={true}
              mode="TAGS"
              placeholder={'Tags select'}
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
              value={state.value3}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value3: newValue }));
              }}
            />
          </>
        )}
      </UseCase>
      <UseCase
        title={'Auto trim'}
        initialState={{
          singleValue: 'option2',
          multiValue: ['option1', 'option2'],
        }}
      >
        {([state, setState]) => (
          <PropertyMatrix
            xLabel="mode"
            yLabel="size"
            x={['SINGLE', 'MULTIPLE', 'TAGS'] as const}
            y={['DEFAULT', 'LARGE'] as const}
          >
            {(mode, size) => (
              <Component
                mode={mode}
                dropdownMatchWidth={false}
                autoTrim={true}
                isCopyable={true}
                placeholder={'Single select'}
                options={[
                  { value: 'option1', label: 'First option' },
                  {
                    value: 'option2',
                    label:
                      'Second option, very very very very very very very very very very very long text here',
                  },
                ]}
                size={size}
                value={mode === 'SINGLE' ? state.singleValue : state.multiValue}
                onChange={(newValue) => {
                  setState((prevState) => ({
                    ...prevState,
                    [mode === 'SINGLE' ? 'singleValue' : 'multiValue']: newValue,
                  }));
                }}
              />
            )}
          </PropertyMatrix>
        )}
      </UseCase>
    </>
  );
}
