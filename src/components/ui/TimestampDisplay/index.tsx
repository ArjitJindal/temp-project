import { Typography } from 'antd';
import React from 'react';
import { dayjs, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT } from '@/utils/dayjs';

interface Props {
  timestamp?: number;
}

export default function TimestampDisplay(props: Props): JSX.Element {
  const { timestamp } = props;
  if (!timestamp) {
    return <>-</>;
  }
  return (
    <div>
      <Typography.Text>{dayjs(timestamp).format(DEFAULT_TIME_FORMAT)}</Typography.Text>
      <br />
      <Typography.Text type={'secondary'}>
        {dayjs(timestamp).format(DEFAULT_DATE_FORMAT)}
      </Typography.Text>
    </div>
  );
}
