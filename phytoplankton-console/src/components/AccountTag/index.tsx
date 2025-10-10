import React from 'react';
import cn from 'clsx';
import Avatar from '../library/Avatar';
import s from './index.module.less';
import { getDisplayedUserInfo, useUsers } from '@/utils/user-utils';
import Skeleton from '@/components/library/Skeleton';
import { loading, success } from '@/utils/asyncResource';

interface Props {
  accountId?: string;
  hideUserName?: boolean;
}

export default function AccountTag(props: Props) {
  const { accountId, hideUserName } = props;
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });
  if (accountId == null) {
    return <></>;
  }
  return (
    <div className={cn(s.root, hideUserName && s.hideUserName)}>
      <Avatar size="xs" user={users[accountId]} isLoading={loadingUsers} />
      <span className={s.userName}>
        <Skeleton res={loadingUsers ? loading(users[accountId]) : success(users[accountId])}>
          {(user) => getDisplayedUserInfo(user).name}
        </Skeleton>
      </span>
    </div>
  );
}
