import cn from 'clsx';
import { Roles, useFeatureEnabled } from '../../Providers/SettingsProvider';
import s from './index.module.less';
import UserPanel from './UserPanel';
import DemoModeSwitch from './DemoModeSwitch';
import SuperAdminModeSwitch from './SuperAdminModeSwitch';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';
import { makeAsyncComponent } from '@/utils/imports';

const SuperAdminPanel = makeAsyncComponent(() => import('./SuperAdminPanel'));

interface Props {
  isCollapsed: boolean;
}

export default function Footer(props: Props) {
  const { isCollapsed } = props;
  const isDemoModeAvailable = useFeatureEnabled('DEMO_MODE');
  const user = useAuth0User();

  return (
    <div className={cn(s.root, isCollapsed && s.isCollapsed)}>
      {isSuperAdmin(user) && <SuperAdminModeSwitch isCollapsed={isCollapsed} />}
      {isDemoModeAvailable && <DemoModeSwitch isCollapsed={isCollapsed} />}
      <UserPanel isCollapsed={isCollapsed} />
      <Roles roles={['root', 'whitelabel-root']}>
        <SuperAdminPanel />
      </Roles>
    </div>
  );
}
