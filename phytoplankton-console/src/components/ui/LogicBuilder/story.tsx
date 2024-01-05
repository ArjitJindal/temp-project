import React from 'react';
import { Fields } from '@react-awesome-query-builder/core';
import fields from './story-fixture.json';
import LogicBuilder from './index';
import { UseCase } from '@/pages/storybook/components';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';

export default function (): JSX.Element {
  return (
    <>
      <UseCase
        title={'Basic'}
        initialState={{
          value: undefined,
          config: makeConfig({
            fields: fields as Fields,
            disableNesting: true,
          }),
        }}
      >
        {([state, setState]) => {
          return (
            <LogicBuilder
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
              config={state.config}
            />
          );
        }}
      </UseCase>
      <UseCase
        title={'Complex conditions enabled'}
        initialState={{
          value: undefined,
          config: makeConfig({
            fields: fields as Fields,
            disableNesting: false,
          }),
        }}
      >
        {([state, setState]) => {
          return (
            <LogicBuilder
              config={state.config}
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
            />
          );
        }}
      </UseCase>
    </>
  );
}
