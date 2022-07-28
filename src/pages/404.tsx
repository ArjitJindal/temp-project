import { Card, Result } from 'antd';
import React from 'react';
// import { history } from 'umi';
import Button from '@/components/ui/Button';

const NoFoundPage: React.FC = () => (
  <Card>
    <Result
      status="404"
      title="404"
      subTitle="Sorry, the page you visited does not exist."
      extra={
        <Button
          analyticsName="Back home"
          type="primary"
          onClick={() => {
            // navigate('/')
          }}
        >
          Back Home
        </Button>
      }
    />
  </Card>
);

export default NoFoundPage;
