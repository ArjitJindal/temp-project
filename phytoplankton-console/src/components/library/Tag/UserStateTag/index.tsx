import React from 'react';
import Tag from '../index';
import { UserState } from '@/apis';
import { humanizeConstant } from '@/utils/humanize';

interface Props {
  userState: UserState;
}

export default function UserStateTag(props: Props) {
  const { userState } = props;

  return <Tag>{humanizeConstant(userState)}</Tag>;
}
