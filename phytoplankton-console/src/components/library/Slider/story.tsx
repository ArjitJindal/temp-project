import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [single, setSingle] = useState<number>();
  const [range, setRange] = useState<[number, number]>();
  return (
    <>
      <UseCase title={'Single'}>
        <PropertyMatrix y={[false, true]} yLabel={'isDisabled'}>
          {(_, isDisabled) => (
            <Component
              mode="SINGLE"
              value={single}
              min={0}
              max={200}
              isDisabled={isDisabled}
              onChange={(newValue) => {
                if (newValue != null) {
                  setSingle(newValue);
                }
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Range'}>
        <PropertyMatrix
          x={[false, true]}
          y={[false, true]}
          xLabel={'isExclusive'}
          yLabel={'isDisabled'}
        >
          {(isExclusive, isDisabled) => (
            <Component
              mode="RANGE"
              value={range}
              min={0}
              max={200}
              isDisabled={isDisabled}
              endExclusive={isExclusive}
              startExclusive={isExclusive}
              onChange={(newValue) => {
                setRange(newValue);
              }}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Single with text input'}>
        <Component
          mode="SINGLE"
          value={single}
          min={0}
          max={200}
          onChange={(newValue) => {
            setSingle(newValue);
          }}
          textInput={{
            value: single,
            onChange: (newValue) => {
              setSingle(newValue);
            },
          }}
        />
      </UseCase>
    </>
  );
}
