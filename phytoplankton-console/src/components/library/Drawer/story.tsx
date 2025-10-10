import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Basic" description="Click button to show the drawer">
        {([state, setState]) => (
          <>
            <Component
              isVisible={state.isVisible ?? false}
              onChangeVisibility={(isVisible) => setState({ isVisible })}
              title="Example drawer title"
              description="Example drawer description text, some details about drawer"
              footer={<div>Sample footer content</div>}
            >
              {[...new Array(10)].map((_, i) => (
                <p key={i}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                  exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
                  irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
                  pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
                  officia deserunt mollit anim id est laborum.
                </p>
              ))}
            </Component>
            <Button
              onClick={() => {
                setState({ isVisible: true });
              }}
            >
              Show drawer
            </Button>
          </>
        )}
      </UseCase>
      <UseCase
        title="With Changes"
        description="Click button to show the drawer with unsaved changes"
      >
        {([state, setState]) => (
          <>
            <Component
              isVisible={state.isVisible ?? false}
              onChangeVisibility={() => setState({ isVisible: false })}
              title="Drawer with unsaved changes"
              description="This drawer has unsaved changes"
              footer={<div>Footer with unsaved changes</div>}
              hasChanges={true}
            >
              <p>This drawer has unsaved changes. Closing it will prompt a confirmation.</p>
            </Component>
            <Button
              onClick={() => {
                setState({ isVisible: true });
              }}
            >
              Show drawer
            </Button>
          </>
        )}
      </UseCase>
    </>
  );
}
