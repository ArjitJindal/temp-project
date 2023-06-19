import React from 'react';
import { Space, Switch } from 'antd';
import cn from 'clsx';
import { useFeatureEnabled } from '../../Providers/SettingsProvider';
import AvatarDropdown from './AvatarDropdown';
import styles from './index.module.less';
import SuperAdminPanel from '@/components/SuperAdminPanel';
import { isAtLeast, useAuth0User, UserRole } from '@/utils/user-utils';
import QuestionLine from '@/components/ui/icons/Remix/system/question-line.react.svg';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr, isLoading } from '@/utils/asyncResource';
import { getBranding } from '@/utils/branding';

export type SiderTheme = 'light' | 'dark';

const branding = getBranding();

export default function RightContent() {
  const user = useAuth0User();
  const isHelpCenterEnabled = useFeatureEnabled('HELP_CENTER');
  const [isDemoModeRes, setDemoMode] = useDemoMode();
  const isDemoModeAvailable = useFeatureEnabled('DEMO_MODE');
  const isDemoMode = getOr(isDemoModeRes, false);

  const helpButton = branding.knowledgeBaseUrl && (
    <div>
      <a href={branding.knowledgeBaseUrl} target="_blank" rel="noopener noreferrer">
        <QuestionLine
          className={cn(styles.icon, getOr(isDemoModeRes, false) && styles.isDemoMode)}
        />
      </a>
    </div>
  );

  return (
    <Space className={styles.right}>
      {isDemoModeAvailable && (
        <label className={cn(styles.demoModeLabel, isDemoMode && styles.isDemoMode)}>
          <span>Demo mode</span>
          <Switch
            loading={isLoading(isDemoModeRes)}
            checked={isDemoMode}
            onChange={() => {
              setDemoMode(!isDemoMode);
            }}
          />
        </label>
      )}
      {isAtLeast(user, UserRole.ROOT) && <SuperAdminPanel />}
      {isHelpCenterEnabled && helpButton}
      <AvatarDropdown />
    </Space>
  );
}
