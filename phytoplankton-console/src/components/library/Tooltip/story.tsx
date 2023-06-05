import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Basic'}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '10rem 10rem 10rem',
            gridGap: '1rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'block' }}>
            <Component title="You can simulate a maximum of 3 iterations for this rule at once.">
              Top
            </Component>
          </div>
          <div style={{ display: 'block' }}>
            <Component
              title="You can simulate a maximum of 3 iterations for this rule at once."
              placement="topLeft"
            >
              Top Left
            </Component>
          </div>
          <div style={{ display: 'block' }}>
            <Component
              title="You can simulate a maximum of 3 iterations for this rule at once."
              placement="topRight"
            >
              Top Right
            </Component>
          </div>
          <div style={{ display: 'block' }}>
            <Component
              title="You can simulate a maximum of 3 iterations for this rule at once."
              placement="bottom"
            >
              Bottom
            </Component>
          </div>
          <div style={{ display: 'block' }}>
            <Component
              title="You can simulate a maximum of 3 iterations for this rule at once."
              placement="bottomLeft"
            >
              Bottom Left
            </Component>
          </div>
          <div style={{ display: 'block' }}>
            <Component
              title="You can simulate a maximum of 3 iterations for this rule at once."
              placement="bottomRight"
            >
              Bottom Right
            </Component>
          </div>
        </div>
      </UseCase>
    </>
  );
}
