import cn from 'clsx';
import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Popover } from 'antd';
import s from './index.module.less';
import LogOutIcon from './log-out.react.svg';
import Avatar from './Avatar';
import { useAuth0User } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';

interface Props {
  isCollapsed: boolean;
}

export default function UserPanel(props: Props) {
  const { isCollapsed } = props;
  const user = useAuth0User();

  const [isPopoverVisible, setPopoverVisible] = useState(false);
  const title = `${user.name}` + (user.verifiedEmail ? ` (${user.verifiedEmail})` : '');

  return (
    <div className={cn(s.root, isCollapsed && s.isCollapsed)} data-sentry-block={true}>
      <div className={s.section}>
        <Popover
          content={<LogOutButton isCollapsed={true} />}
          trigger="hover"
          placement="right"
          visible={isCollapsed && isPopoverVisible}
          onVisibleChange={(visible) => {
            if (isCollapsed) {
              setPopoverVisible(visible);
            }
          }}
        >
          <div className={s.avatarWrapper} title={title}>
            <Avatar />
          </div>
        </Popover>
        <div className={s.nameAndEmail}>
          <div className={s.name}>{user.name}</div>
          <div className={s.email}>{user.verifiedEmail}</div>
        </div>
      </div>
      {!isCollapsed && <LogOutButton isCollapsed={false} />}
    </div>
  );
}

function LogOutButton(props: { isCollapsed: boolean }) {
  const { isCollapsed } = props;
  const { logout } = useAuth0();
  return (
    <Confirm
      title={'Are you sure you want to log out?'}
      text={'You will be returned to the login screen.'}
      onConfirm={() => {
        logout({
          returnTo: window.location.origin,
        });
      }}
    >
      {({ onClick }) => (
        <div
          className={cn(s.logoutButton, isCollapsed && s.isCollapsed)}
          onClick={onClick}
          data-cy={'logout-button'}
        >
          {isCollapsed && 'Log out'}
          <LogOutIcon className={s.logoutIcon} />
        </div>
      )}
    </Confirm>
  );
}
