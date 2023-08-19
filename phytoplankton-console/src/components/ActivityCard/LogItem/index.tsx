import React, { ReactElement } from 'react';
import s from './index.module.less';
import { Account } from '@/apis';
import CaseIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { useUser } from '@/utils/user-utils';
import Avatar from '@/components/Avatar';

export interface LogItemData {
  time: string;
  icon: 'CASE' | 'USER';
  user?: Account;
  statement: ReactElement;
}

interface Props {
  logItem: LogItemData;
}

const LogItem = (props: Props) => {
  const { logItem } = props;
  const { time, user, icon, statement } = logItem;
  const currentUser = useUser(user?.id);
  const getIcon = (icon: string) => {
    return icon === 'CASE' ? (
      <div className={s.logIcon}>
        <CaseIcon width={20} height={20} />
      </div>
    ) : (
      <Avatar size="small" user={currentUser} />
    );
  };
  return (
    <div className={s.root}>
      <div className={s.time}>{time.toLowerCase()}</div>
      <div className={s.logItem}>
        {getIcon(icon)}
        <div className={s.log}>{statement}</div>
      </div>
    </div>
  );
};

export default LogItem;
