import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import { User } from '../../../types';
import s from './style.module.less';
import { getUserName } from '@/utils/api/users';
import RiskLevelTag from '@/components/ui/RiskLevelTag';

interface Props {
  isActive: boolean;
  user: User;
  onClick: () => void;
}

export default function UserItem(props: Props) {
  const { isActive, user, onClick } = props;

  // todo: i18n
  return (
    <List.Item
      className={cn(s.root, isActive && s.isActive)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
    >
      <List.Item.Meta
        title={<span className={s.userName}>{getUserName(user)}</span>}
        description={user.userId}
      />
      {user.riskLevel && <RiskLevelTag level={user.riskLevel} />}
    </List.Item>
  );
}
