import { Card, Result } from 'antd';
import React from 'react';

const ForbiddenPage: React.FC = () => (
  <Card>
    <Result
      status="403"
      title="403"
      subTitle="Sorry, you do not have the required permissions to access this page."
    />
  </Card>
);

export default ForbiddenPage;
