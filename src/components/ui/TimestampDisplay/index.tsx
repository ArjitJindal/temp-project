import { Typography } from 'antd';
import moment from 'moment';
import React from 'react';
import { DEFAULT_DATE_DISPLAY_FORMAT, DEFAULT_TIME_DISPLAY_FORMAT } from '@/utils/dates';

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
      <Typography.Text>{moment(timestamp).format(DEFAULT_TIME_DISPLAY_FORMAT)}</Typography.Text>
      <br />
      <Typography.Text type={'secondary'}>
        {moment(timestamp).format(DEFAULT_DATE_DISPLAY_FORMAT)}
      </Typography.Text>
    </div>
  );
}
