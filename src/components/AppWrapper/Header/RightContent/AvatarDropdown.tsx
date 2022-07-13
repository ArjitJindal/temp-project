import React, { useCallback } from 'react';
import { LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { Avatar, Menu, Spin } from 'antd';
import { useAuth0 } from '@auth0/auth0-react';
import type { MenuInfo } from 'rc-menu/lib/interface';
import { useNavigate } from 'react-router';
import HeaderDropdown from '../../../HeaderDropdown';
import styles from './index.module.less';
import { isAtLeastAdmin, useAuth0User } from '@/utils/user-utils';

export type GlobalHeaderRightProps = {
  menu?: boolean;
};

const AvatarDropdown: React.FC<GlobalHeaderRightProps> = () => {
  const { logout } = useAuth0();
  const user = useAuth0User();
  const isAdmin = isAtLeastAdmin(user);
  const navigate = useNavigate();

  const onMenuClick = useCallback(
    (event: MenuInfo) => {
      const { key } = event;
      if (key === 'logout') {
        logout({ returnTo: window.location.origin });
        return;
      }
      if (key === 'settings') {
        navigate(`/accounts`);
        return;
      }
      navigate(`/account/${key}`);
    },
    [navigate, logout],
  );

  const loading = (
    <span className={`${styles.action} ${styles.account}`}>
      <Spin
        size="small"
        style={{
          marginLeft: 8,
          marginRight: 8,
        }}
      />
    </span>
  );

  if (!user || !user.name) {
    return loading;
  }

  const menuHeaderDropdown = (
    <Menu className={styles.menu} selectedKeys={[]} onClick={onMenuClick}>
      {isAdmin && (
        <Menu.Item key="settings" icon={<SettingOutlined />}>
          Settings
        </Menu.Item>
      )}
      {isAdmin && <Menu.Divider />}

      <Menu.Item key="logout" icon={<LogoutOutlined />}>
        Logout
      </Menu.Item>
    </Menu>
  );
  return (
    <HeaderDropdown overlay={menuHeaderDropdown}>
      <span className={`${styles.root} ${styles.action} ${styles.account}`}>
        <Avatar size="small" className={styles.avatar} src={user.picture} alt="avatar" />
        <span className={`${styles.name} anticon`}>{user.name}</span>
      </span>
    </HeaderDropdown>
  );
};

export default AvatarDropdown;
