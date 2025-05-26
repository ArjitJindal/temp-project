import React from 'react';
import s from './index.module.less';
import * as ar from '@/utils/asyncResource';
import Spinner from '@/components/library/Spinner';
import Alert from '@/components/library/Alert';

interface Props<T> {
  resource: ar.AsyncResource<T>;
  children: (value: T) => React.ReactNode;
  renderInit?: () => React.ReactNode;
  renderLoading?: (value: T | null) => React.ReactNode;
  renderFailed?: (message: string) => React.ReactNode;
}

export function AsyncResourceRenderer<T>(props: Props<T>): JSX.Element {
  const {
    resource,
    children,
    renderInit = () => <></>,
    renderLoading = (lastState: T | null) => {
      if (lastState != null) {
        return <Spinner>{children(lastState)}</Spinner>;
      }
      return (
        <div className={s.spinContainer}>
          <Spinner />
        </div>
      );
    },
    renderFailed = (reason) => {
      return <Alert type="ERROR">{reason}</Alert>;
    },
  } = props;
  return (
    <>
      {ar.match(resource, {
        init: renderInit,
        loading: renderLoading,
        success: children,
        failed: renderFailed,
      })}
    </>
  );
}

export default AsyncResourceRenderer;
