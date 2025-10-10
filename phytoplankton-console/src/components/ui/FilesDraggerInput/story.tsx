import React from 'react';
import FilesDraggerInput from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Basic case">
        <FilesDraggerInput />
      </UseCase>
      <UseCase title="Custom accepted filed">
        <FilesDraggerInput accept={['image/png', 'application/x-7z-compressed']} />
      </UseCase>
      <UseCase title="Custom info text">
        <FilesDraggerInput info={'Custom info text here'} />
      </UseCase>
    </>
  );
}
