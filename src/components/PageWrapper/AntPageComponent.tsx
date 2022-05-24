import React from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { PageContainerProps } from '@ant-design/pro-layout/lib/components/PageContainer';

export default function AntPageContainer(props: PageContainerProps) {
  return <PageContainer header={{ breadcrumb: {} }} {...props} />;
}
