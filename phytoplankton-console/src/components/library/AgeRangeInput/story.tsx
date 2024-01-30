import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Basic use case'}>
        {([state, setState]) => (
          <>
            <Component
              value={state.value1}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value1: newValue }));
              }}
            />
          </>
        )}
      </UseCase>
    </>
  );
}
