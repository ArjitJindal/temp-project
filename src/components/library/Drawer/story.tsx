import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/ui/Button';

export default function (): JSX.Element {
  const [isVisible, setVisible] = useState(false);
  return (
    <UseCase title="Basic" description="Click button to show the drawer">
      <Component
        isVisible={isVisible}
        onChangeVisibility={setVisible}
        title="Example drawer title"
        description="Example drawer description text, some details about drawer"
        footer={<div>Sample footer content</div>}
      >
        {[...new Array(10)].map((_, i) => (
          <p key={i}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
            exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
            dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
            mollit anim id est laborum.
          </p>
        ))}
      </Component>
      <Button
        onClick={() => {
          setVisible(true);
        }}
      >
        Show drawer
      </Button>
    </UseCase>
  );
}
