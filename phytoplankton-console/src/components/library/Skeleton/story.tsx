import React from 'react';
import Skeleton from './index';
import { UseCase } from '@/pages/storybook/components';
import { success, failed, loading, init } from '@/utils/asyncResource';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Success'}>
        <p>
          Some text before, <Skeleton res={success(42)}>success text</Skeleton>, some text after
        </p>
      </UseCase>
      <UseCase title={'Init'}>
        <p>
          Some text before, <Skeleton res={init()}>success text</Skeleton>, some text after
        </p>
      </UseCase>
      <UseCase title={'Loading'}>
        <p>
          Some text before, <Skeleton res={loading()}>success text</Skeleton>, some text after
        </p>
      </UseCase>
      <UseCase title={'Failed'}>
        <p>
          Some text before, <Skeleton res={failed('Error reason goes here')}>success text</Skeleton>
          , some text after
        </p>
      </UseCase>
    </>
  );
}
