import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import pluralize from 'pluralize';
import s from './style.module.less';
import { getUserName } from '@/utils/api/users';
import RiskLevelTag from '@/components/library/Tag/RiskLevelTag';
import { AllUsersTableItem } from '@/apis';

interface Props {
  isActive: boolean;
  user: AllUsersTableItem;
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
        className={s.meta}
        title={<span className={s.userName}>{getUserName(user)}</span>}
        description={<span className={s.id}>{user.userId}</span>}
      />
      {user.riskLevel && <RiskLevelTag level={user.riskLevel} />}
      <div className={cn(s.casesCount)}>{pluralize('case', user.casesCount, true)}</div>
    </List.Item>
  );
}
