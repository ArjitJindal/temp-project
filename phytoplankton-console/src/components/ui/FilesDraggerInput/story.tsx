import React from 'react';
import FilesDraggerInput from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Basic case">
        <FilesDraggerInput />
      </UseCase>
    </>
  );
}
