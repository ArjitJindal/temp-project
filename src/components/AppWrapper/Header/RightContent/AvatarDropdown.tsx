import React, { useCallback } from 'react';
import { LogoutOutlined } from '@ant-design/icons';
import { Avatar, Menu, Spin } from 'antd';
import type { MenuInfo } from 'rc-menu/es/interface';
import { useNavigate } from 'react-router';
import HeaderDropdown from '../../../HeaderDropdown';
import styles from './index.module.less';
import { useAuth0User } from '@/utils/user-utils';
import { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';

export type GlobalHeaderRightProps = {
  menu?: boolean;
};

const AvatarDropdown: React.FC<GlobalHeaderRightProps> = () => {
  const user = useAuth0User();
  const { logout } = useAuth();

  const navigate = useNavigate();

  const onMenuClick = useCallback(
    (event: MenuInfo) => {
      const { key } = event;
      if (key === 'logout') {
        logout();
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
    <Menu
      className={styles.menu}
      selectedKeys={[]}
      onClick={onMenuClick}
      items={[
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: 'Logout',
        },
      ]}
    />
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
