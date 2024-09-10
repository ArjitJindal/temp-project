import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Tag from '../index';
import { UserState } from '@/apis';

interface Props {
  userState: UserState;
}

export default function UserStateTag(props: Props) {
  const { userState } = props;

  return <Tag>{humanizeConstant(userState)}</Tag>;
}
