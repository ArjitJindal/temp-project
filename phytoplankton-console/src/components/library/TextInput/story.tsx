import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-2-line.react.svg';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [value, setValue] = useState<string | undefined>('input value');
  return (
    <>
      <UseCase title={'Basic case'}>
        <PropertyMatrix xLabel={'size'} x={['X1', 'X2'] as const}>
          {(size) => (
            <Component
              size={size}
              value={value}
              placeholder={'Placeholder example'}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Placeholder'}>
        <PropertyMatrix xLabel={'size'} x={['X1', 'X2'] as const}>
          {(size) => (
            <Component
              placeholder={'Placeholder example'}
              size={size}
              value={''}
              onChange={() => {}}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'With icon'}>
        <PropertyMatrix xLabel={'size'} x={['X1', 'X2'] as const}>
          {(x) => (
            <Component
              key={x}
              size={x}
              value={value}
              icon={<SearchLineIcon />}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'With icon on right'}>
        <PropertyMatrix xLabel={'size'} x={['X1', 'X2'] as const}>
          {(x) => (
            <Component
              key={x}
              size={x}
              value={value}
              icon={<SearchLineIcon />}
              iconRight={<SearchLineIcon />}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Disabled'}>
        <Component
          isDisabled={true}
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Error'}>
        <PropertyMatrix xLabel={'isDisabled'} x={[false, true]}>
          {(isDisabled) => (
            <Component
              isError={true}
              isDisabled={isDisabled}
              icon={<SearchLineIcon />}
              value={value}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Success'}>
        <PropertyMatrix xLabel={'isDisabled'} x={[false, true]}>
          {(isDisabled) => (
            <Component
              isSuccess={true}
              isDisabled={isDisabled}
              icon={<SearchLineIcon />}
              value={value}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Loading'}>
        <PropertyMatrix xLabel={'isDisabled'} x={[false, true]}>
          {(isDisabled) => (
            <Component
              isLoading={true}
              isDisabled={isDisabled}
              icon={<SearchLineIcon />}
              value={value}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Description'}>
        <PropertyMatrix
          xLabel={'size'}
          x={['X1', 'X2'] as const}
          y={['Default', 'Success', 'Error']}
        >
          {(x, y) => (
            <Component
              size={x}
              isError={y === 'Error'}
              isSuccess={y === 'Success'}
              isLoading={true}
              icon={<SearchLineIcon />}
              value={value}
              onChange={(newValue) => {
                setValue(newValue);
              }}
              description={'Sample description'}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Clearable'}>
        <PropertyMatrix xLabel={'size'} x={['X1', 'X2'] as const}>
          {(size) => (
            <Component
              size={size}
              allowClear={true}
              placeholder={'Placeholder example'}
              value={value}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'All icons'}>
        <PropertyMatrix xLabel={'size'} x={['X1', 'X2'] as const}>
          {(x) => (
            <Component
              key={x}
              size={x}
              value={value}
              icon={<SearchLineIcon />}
              iconRight={<SearchLineIcon />}
              isLoading={true}
              allowClear={true}
              onChange={(newValue) => {
                setValue(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
