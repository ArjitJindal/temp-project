import { Card, Spin } from 'antd';

export default () => (
  <Card bordered={false}>
    <div style={{ textAlign: 'center' }}>
      <Spin size="large" />
    </div>
  </Card>
);
