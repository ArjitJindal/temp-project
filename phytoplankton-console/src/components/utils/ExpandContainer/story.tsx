import React from 'react';
import Button from '../../library/Button';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Basic case'}>
        {([state, setState]) => (
          <>
            <Button
              onClick={() => {
                setState((prevState) => ({ isCollapsed: !prevState.isCollapsed }));
              }}
            >
              {state.isCollapsed ? 'Expand' : 'Collapse'}
            </Button>
            <Component isCollapsed={state.isCollapsed ?? false}>
              <div style={{ background: 'yellow', padding: '1rem' }}>sample content</div>
            </Component>
          </>
        )}
      </UseCase>
    </>
  );
}
