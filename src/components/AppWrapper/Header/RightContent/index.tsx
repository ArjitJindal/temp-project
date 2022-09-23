import React from 'react';
import { Space } from 'antd';
import { useFeature } from '../../Providers/SettingsProvider';
import AvatarDropdown from './AvatarDropdown';
import styles from './index.module.less';
import SuperAdminPanel from '@/components/SuperAdminPanel';
import { isAtLeast, useAuth0User, UserRole } from '@/utils/user-utils';
import QuestionLine from '@/components/ui/icons/Remix/system/question-line.react.svg';

export type SiderTheme = 'light' | 'dark';

export default function RightContent() {
  const user = useAuth0User();
  const isHelpCenterEnabled = useFeature('HELP_CENTER');

  const helpButton = (
    <div>
      <a
        href="https://www.support.flagright.com/knowledge"
        target="_blank"
        rel="noopener noreferrer"
      >
        <QuestionLine className={styles.icon} />
      </a>
    </div>
  );

  return (
    <Space className={styles.right}>
      {isAtLeast(user, UserRole.ROOT) && <SuperAdminPanel />}
      {isHelpCenterEnabled && helpButton}
      <AvatarDropdown />
    </Space>
  );
}
