import React, { ReactElement } from 'react';
import s from './index.module.less';
import { dayjs, TIME_FORMAT_WITHOUT_SECONDS } from '@/utils/dayjs';

export interface LogItemData {
  timestamp: number;
  icon: React.ReactNode;
  statement: ReactElement;
}

interface Props {
  logItem: LogItemData;
}

export default function LogItem(props: Props) {
  const { logItem } = props;
  const { timestamp, icon, statement } = logItem;
  const time = dayjs(timestamp).format(TIME_FORMAT_WITHOUT_SECONDS);
  return (
    <div data-cv="log-entry-item" className={s.root}>
      <div data-cv="log-entry-item-date" className={s.time}>
        {time.toLowerCase()}
      </div>
      <div data-cv="log-entry-item-text" className={s.logItem}>
        <div className={s.logIcon}>{icon}</div>
        <div className={s.log}>{statement}</div>
      </div>
    </div>
  );
}
