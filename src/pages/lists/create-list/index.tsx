import { Button, Card } from 'antd';
import type { FC } from 'react';
import { PageContainer } from '@ant-design/pro-layout';

const BasicForm: FC<Record<string, any>> = () => {
  return (
    <PageContainer content="Create a custom list to allow, block or flag events.">
      <Card bordered={false}>
        <>
          <Button>Upload CSV</Button>
        </>
      </Card>
    </PageContainer>
  );
};

export default BasicForm;
