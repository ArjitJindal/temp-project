import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { AsyncResource, loading, isLoading } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { makeRandomNumberGenerator } from '@/utils/prng';

const random = makeRandomNumberGenerator(999999);

const RENDER_NOTHING = () => {
  return null;
};

export function shouldShowSkeleton<T>(dataRes: AsyncResource<T>): boolean {
  return isLoading(dataRes) && dataRes.lastValue == null;
}

interface Props<T> {
  res?: AsyncResource<T>;
  text?: string;
  length?: number;
  children?: ((value: T) => React.ReactNode) | React.ReactNode;
}

export default function Skeleton<T>(props: Props<T>): JSX.Element {
  const { res = loading(), text, length = 4 + Math.round(10 * random()), children } = props;
  let newChildren: (value: T) => React.ReactNode = RENDER_NOTHING;
  if (typeof children === 'function') {
    newChildren = children as (value: T) => React.ReactNode;
  } else if (children != null) {
    newChildren = () => children;
  }

  const renderSkeleton = () => {
    return (
      <span className={s.skeleton} data-cy="skeleton">
        {text ?? [...new Array(length)].map(() => '■').join('')}
      </span>
    );
  };

  const renderFailed = (reason: string) => {
    return (
      <span className={cn(s.failed)} title={reason} data-cy="skeleton">
        N/A
      </span>
    );
  };

  const renderLoading = (value?: T | null): React.ReactNode => {
    if (value && typeof children === 'function') {
      return <>{children?.(value)}</>;
    }
    return <>{renderSkeleton()}</>;
  };

  return (
    <AsyncResourceRenderer
      resource={res}
      renderLoading={renderLoading}
      renderInit={renderLoading}
      renderFailed={renderFailed}
    >
      {newChildren}
    </AsyncResourceRenderer>
  );
}
