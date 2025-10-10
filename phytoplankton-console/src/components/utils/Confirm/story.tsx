import React from 'react';
import Button from '../../library/Button';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import { loading, success, init } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Confirm modal'}>
        <Component
          text="Are you sure you want to do this?"
          onConfirm={() => {
            message.success('Confirmed!');
          }}
        >
          {({ onClick }) => <Button onClick={onClick}>Show</Button>}
        </Component>
      </UseCase>
      <UseCase title={'Confirm modal with comment'}>
        <Component
          text="Are you sure you want to do this?"
          commentRequired
          onConfirm={() => {
            message.success('Confirmed!');
          }}
        >
          {({ onClick }) => <Button onClick={onClick}>Show</Button>}
        </Component>
      </UseCase>
      <UseCase title={'With async resource'} initialState={{ res: init() }}>
        {([state, setState]) => (
          <Component
            text="Are you sure you want to do this?"
            commentRequired
            res={state.res}
            onSuccess={() => {
              message.success('Success!');
            }}
            onConfirm={() => {
              setState((prevState) => ({ ...prevState, res: loading() }));
              setTimeout(() => {
                setState((prevState) => ({ ...prevState, res: success('Success!') }));
              }, 3000);
            }}
          >
            {({ onClick }) => <Button onClick={onClick}>Show</Button>}
          </Component>
        )}
      </UseCase>
    </>
  );
}
