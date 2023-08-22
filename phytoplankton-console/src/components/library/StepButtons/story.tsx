import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [counter, setCounter] = useState(0);
  return (
    <>
      <UseCase title={'Basic case'}>
        <Component
          prevDisabled={counter === 0}
          nextDisabled={counter === 3}
          onNext={() => {
            setCounter((counter) => counter + 1);
          }}
          onPrevious={() => {
            setCounter((counter) => counter - 1);
          }}
        />
      </UseCase>
      <UseCase title={'With action'}>
        <Component
          prevDisabled={counter === 0}
          nextDisabled={counter === 3}
          onNext={() => {
            setCounter((counter) => counter + 1);
          }}
          onPrevious={() => {
            setCounter((counter) => counter - 1);
          }}
          actionProps={{
            actionText: 'Save',
            onAction: () => null,
          }}
        />
      </UseCase>
    </>
  );
}
