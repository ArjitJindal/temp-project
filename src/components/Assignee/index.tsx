import React from 'react';
import { Avatar } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import s from './index.module.less';
import { useUsers } from '@/utils/user-utils';

interface Props {
  accountId?: string;
}

export function Assignee(props: Props) {
  const { accountId } = props;
  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });

  if (accountId == null) {
    return <></>;
  }
  return (
    <div className={s.root}>
      {loadingUsers ? (
        <LoadingOutlined />
      ) : (
        <>
          <Avatar size="small" src={users[accountId]?.picture} />
          {users[accountId]?.name ?? accountId}
        </>
      )}
    </div>
  );
}
