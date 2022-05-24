import React from 'react';
import { PageContainerProps } from '@ant-design/pro-layout/lib/components/PageContainer';
import AntConfigProvider from './AntConfigProvider';
import AntPageComponent from './AntPageComponent';

interface Props {
  pageContainerProps?: PageContainerProps;
  children?: React.ReactNode;
}

export default function PageWrapper(props: Props) {
  return (
    <AntConfigProvider>
      <AntPageComponent {...props.pageContainerProps}>{props.children}</AntPageComponent>
    </AntConfigProvider>
  );
}
