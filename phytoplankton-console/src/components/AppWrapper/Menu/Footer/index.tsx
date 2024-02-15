import cn from 'clsx';
import React from 'react';
import { Roles, useFeatureEnabled } from '../../Providers/SettingsProvider';
import SuperAdminPanel from './SuperAdminPanel';
import s from './index.module.less';
import UserPanel from './UserPanel';
import DemoModeSwitch from './DemoModeSwitch';

interface Props {
  isCollapsed: boolean;
}

export default function Footer(props: Props) {
  const { isCollapsed } = props;
  const isDemoModeAvailable = useFeatureEnabled('DEMO_MODE');

  return (
    <div className={cn(s.root, isCollapsed && s.isCollapsed)}>
      {isDemoModeAvailable && <DemoModeSwitch isCollapsed={isCollapsed} />}
      <UserPanel isCollapsed={isCollapsed} />
      <Roles roles={['root', 'whitelabel-root']}>
        <SuperAdminPanel />
      </Roles>
    </div>
  );
}
