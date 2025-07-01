import React from 'react';
import { dayjs, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT } from '@/utils/dayjs';
import { P } from '@/components/ui/Typography';

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
      <P variant="m">{dayjs(timestamp).format(timeFormat)}</P>
      <P variant="m" grey>
        {dayjs(timestamp).format(DEFAULT_DATE_FORMAT)}
      </P>
    </div>
  );
}
