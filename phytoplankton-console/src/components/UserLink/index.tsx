import React from 'react';
import { Link } from 'react-router-dom';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { getUserLink } from '@/utils/api/users';

interface Props {
  user: InternalBusinessUser | InternalConsumerUser;
  children?: string;
  testName?: string;
}

export default function UserLink(props: Props) {
  const { user, children, testName } = props;
  const userLink = getUserLink(user);
  return (
    <Link to={userLink ?? '#'} data-cy={testName}>
      {children}
    </Link>
  );
}
