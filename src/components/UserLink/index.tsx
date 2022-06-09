import React from 'react';
import { Link } from 'umi';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { neverReturn } from '@/utils/lang';

interface Props {
  user: InternalBusinessUser | InternalConsumerUser;
  children: React.ReactNode;
}

export default function UserLink(props: Props) {
  const { user, children } = props;
  if (user.type === 'CONSUMER') {
    return <Link to={`/users/list/consumer/${user.userId}`}>{children}</Link>;
  }
  if (user.type === 'BUSINESS') {
    return <Link to={`/users/list/business/${user.userId}`}>{children}</Link>;
  }
  return <>{neverReturn(user, children)}</>;
}
