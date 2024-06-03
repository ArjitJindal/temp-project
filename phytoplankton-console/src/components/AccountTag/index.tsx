import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import Avatar from '../library/Avatar';
import s from './index.module.less';
import { useUsers } from '@/utils/user-utils';
import { getNonSuperAdminUserName } from '@/utils/account';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';

interface Props {
  accountId?: string;
}

export default function AccountTag(props: Props) {
  const { accountId } = props;
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });
  if (accountId == null) {
    return <></>;
  }
  return (
    <div className={s.root}>
      {loadingUsers ? (
        <LoadingOutlined className={CY_LOADING_FLAG_CLASS} />
      ) : (
        <>
          <Avatar size="xs" user={users[accountId]} />
          {getNonSuperAdminUserName(users[accountId])}
        </>
      )}
    </div>
  );
}
