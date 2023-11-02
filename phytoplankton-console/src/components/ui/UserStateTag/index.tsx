import React from 'react';
import { Tag } from 'antd';
import { capitalize } from 'lodash';
import { UserState } from '@/apis';

interface Props {
  userState: UserState;
}

export default function UserStateTag(props: Props) {
  const { userState } = props;

  return <Tag>{capitalize(userState)}</Tag>;
}
