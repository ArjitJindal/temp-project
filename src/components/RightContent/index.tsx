import { Space } from 'antd';
import React from 'react';
import { useModel } from 'umi';
import Avatar from './AvatarDropdown';
import styles from './index.less';
import SuperAdminPanel from '@/components/SuperAdminPanel';
import { isAtLeast, useAuth0User, UserRole } from '@/utils/user-utils';

export type SiderTheme = 'light' | 'dark';

const GlobalHeaderRight: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const user = useAuth0User();

  if (!initialState || !initialState.settings) {
    return null;
  }

  const { navTheme, layout } = initialState.settings;
  let className = styles.right;

  if ((navTheme === 'dark' && layout === 'top') || layout === 'mix') {
    className = `${styles.right}  ${styles.dark}`;
  }

  return (
    <Space className={className}>
      {isAtLeast(user, UserRole.ROOT) && <SuperAdminPanel />}
      <Avatar menu />
    </Space>
  );
};

export default GlobalHeaderRight;
