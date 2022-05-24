import React, { useEffect } from 'react';
import { PageContainerProps } from '@ant-design/pro-layout/lib/components/PageContainer';
import AuthProvider from './AuthProvider';

interface Props {
  pageContainerProps?: PageContainerProps;
  children?: React.ReactNode;
}

export default function AppWrapper(props: Props) {
  return <AuthProvider>{props.children}</AuthProvider>;
}
