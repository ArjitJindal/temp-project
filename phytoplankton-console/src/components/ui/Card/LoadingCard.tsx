import { Card, Space } from 'antd';
import { P } from '../Typography';
import Spinner from '@/components/library/Spinner';

export function LoadingCard(props: { loadingMessage?: string }) {
  return (
    <Card
      bordered={false}
      style={{ height: '100%', width: '100%' }}
      bodyStyle={{ height: 'inherit', width: 'inherit', display: 'flex', alignItems: 'center' }}
    >
      <Space direction="vertical" style={{ textAlign: 'center', width: 'inherit' }}>
        <Spinner size="LARGE" />
        {props.loadingMessage && <P>{props.loadingMessage}</P>}
      </Space>
    </Card>
  );
}
