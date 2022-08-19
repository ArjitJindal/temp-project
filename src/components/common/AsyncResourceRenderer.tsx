import React from 'react';
import { Alert, Empty, Spin } from 'antd';
import * as ar from '@/utils/asyncResource';

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
        return <Spin>{children(lastState)}</Spin>;
      }
      // todo: i18n
      return (
        <Spin>
          <Empty description="Please, wait..." style={{ margin: '1rem 0' }} />
        </Spin>
      );
    },
    renderFailed = (reason) => {
      return <Alert message={reason} type="error" />;
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
