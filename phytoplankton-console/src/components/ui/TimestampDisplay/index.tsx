import { Typography } from 'antd';
import React from 'react';
import { dayjs, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT } from '@/utils/dayjs';

interface Props {
  timestamp?: number;
  timeFormat?: 'LT' | 'LTS';
}

export default function TimestampDisplay(props: Props): JSX.Element {
  const { timestamp, timeFormat = DEFAULT_TIME_FORMAT } = props;
  if (!timestamp) {
    return <>-</>;
  }
  return (
    <div>
      <Typography.Text>{dayjs(timestamp).format(timeFormat)}</Typography.Text>
      <br />
      <Typography.Text type={'secondary'}>
        {dayjs(timestamp).format(DEFAULT_DATE_FORMAT)}
      </Typography.Text>
    </div>
  );
}
