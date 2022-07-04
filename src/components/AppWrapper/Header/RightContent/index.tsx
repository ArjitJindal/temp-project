import React from 'react';
import { Space } from 'antd';
import AvatarDropdown from './AvatarDropdown';
import styles from './index.module.less';
import SuperAdminPanel from '@/components/SuperAdminPanel';
import { isAtLeast, useAuth0User, UserRole } from '@/utils/user-utils';

export type SiderTheme = 'light' | 'dark';

export default function RightContent() {
  const user = useAuth0User();

  return (
    <Space className={styles.right}>
      {isAtLeast(user, UserRole.ROOT) && <SuperAdminPanel />}
      <AvatarDropdown />
    </Space>
  );
}
