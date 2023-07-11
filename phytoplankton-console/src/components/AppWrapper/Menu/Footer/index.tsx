import cn from 'clsx';
import React from 'react';
import SuperAdminPanel from '../../../SuperAdminPanel';
import { useFeatureEnabled } from '../../Providers/SettingsProvider';
import s from './index.module.less';
import UserPanel from './UserPanel';
import DemoModeSwitch from './DemoModeSwitch';
import { isAtLeast, useAuth0User, UserRole } from '@/utils/user-utils';

interface Props {
  isCollapsed: boolean;
}

export default function Footer(props: Props) {
  const { isCollapsed } = props;
  const user = useAuth0User();
  const isDemoModeAvailable = useFeatureEnabled('DEMO_MODE');

  return (
    <div className={cn(s.root, isCollapsed && s.isCollapsed)}>
      {isDemoModeAvailable && <DemoModeSwitch isCollapsed={isCollapsed} />}
      <UserPanel isCollapsed={isCollapsed} />
      {isAtLeast(user, UserRole.ROOT) && <SuperAdminPanel />}
    </div>
  );
}
