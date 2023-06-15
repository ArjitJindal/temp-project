import React from 'react';
import { TooltipPlacement } from 'antd/lib/tooltip';
import Tooltip from '../Tooltip';
import s from './index.module.less';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';

export default function SuperAdminContainer(props: {
  tooltip: React.ReactNode;
  tooltipPlacement?: TooltipPlacement;
  children: React.ReactNode;
}) {
  const user = useAuth0User();
  if (!isSuperAdmin(user)) {
    return null;
  }
  return (
    <div className={s.root}>
      <Tooltip
        title={props.tooltip ?? 'This is only visible to super-admin users.'}
        placement={props.tooltipPlacement}
      >
        <div className={s.title}>super-admin-only</div>
      </Tooltip>
      <div className={s.children}>{props.children}</div>
    </div>
  );
}
