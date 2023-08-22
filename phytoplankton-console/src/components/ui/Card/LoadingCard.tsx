import { Card, Space, Spin } from 'antd';
import { P } from '../Typography';

export function LoadingCard(props: { loadingMessage?: string }) {
  return (
    <Card
      bordered={false}
      style={{ height: '100%', width: '100%' }}
      bodyStyle={{ height: 'inherit', width: 'inherit', display: 'flex', alignItems: 'center' }}
    >
      <Space direction="vertical" style={{ textAlign: 'center', width: 'inherit' }}>
        <Spin size="large" />
        {props.loadingMessage && <P>{props.loadingMessage}</P>}
      </Space>
    </Card>
  );
}
