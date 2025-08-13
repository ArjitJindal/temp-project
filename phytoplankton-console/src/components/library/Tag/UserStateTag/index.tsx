import React from 'react';
import Tag from '../index';
import { UserState } from '@/apis';
import { humanizeUserStatus } from '@/components/utils/humanizeUserStatus';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  userState: UserState;
}

export default function UserStateTag(props: Props) {
  const { userState } = props;
  const settings = useSettings();

  return <Tag>{humanizeUserStatus(userState, settings.userStateAlias)}</Tag>;
}
