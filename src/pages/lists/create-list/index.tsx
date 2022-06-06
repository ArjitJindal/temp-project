import { Card } from 'antd';
import type { FC } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import PageWrapper from '@/components/PageWrapper';
import Button from '@/components/ui/Button';

const BasicForm: FC<Record<string, any>> = () => {
  return (
    <PageWrapper
      pageContainerProps={{
        content: 'Create a custom list to allow, block or flag events.',
      }}
    >
      <Card bordered={false}>
        <>
          <Button analyticsName="Upload CSV">Upload CSV</Button>
        </>
      </Card>
    </PageWrapper>
  );
};

export default BasicForm;
