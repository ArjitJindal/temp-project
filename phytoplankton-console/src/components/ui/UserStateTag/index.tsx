import React from 'react';
import { Tag } from 'antd';
import _ from 'lodash';
import { UserState } from '@/apis';

interface Props {
  userState: UserState;
}

export default function UserStateTag(props: Props) {
  const { userState } = props;

  return <Tag>{_.capitalize(userState)}</Tag>;
}
