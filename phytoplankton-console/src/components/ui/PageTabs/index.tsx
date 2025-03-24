import { Tabs as AntTabs, TabsProps } from 'antd';
import cn from 'clsx';
import { TabsType } from 'antd/lib/tabs';
import React from 'react';
import s from './index.module.less';
import { TabItem } from '@/components/library/Tabs';
import { captureTabEvent } from '@/utils/postHog';
import { Permission } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';

export const TABS_LINE_HEIGHT = 81;

export type TabItemWithPermissions = TabItem & { requiredPermissions?: Permission[] };

interface Props extends Pick<TabsProps, 'activeKey' | 'onChange' | 'tabBarExtraContent'> {
  items?: TabItemWithPermissions[];
  sticky?: number;
  compact?: boolean;
  isPrimary?: boolean;
  type?: TabsType;
  eventData?: Record<string, any>;
}

export default function PageTabs(props: Props) {
  const user = useAuth0User();
  const permissions = user?.permissions ?? new Map<Permission, boolean>();
  const {
    sticky,
    compact,
    isPrimary = true,
    type = 'line',
    items,
    activeKey,
    onChange,
    tabBarExtraContent,
    eventData,
  } = props;
  return (
    <AntTabs
      className={cn(s.root, {
        [s.compact]: compact,
        [s.isSticky]: sticky != null,
        [s.isPrimary]: isPrimary,
      })}
      activeKey={activeKey}
      onChange={(key) => {
        captureTabEvent(activeKey, key, items ?? [], { ...eventData, component: 'PageTabs' });
        onChange?.(key);
      }}
      type={type}
      destroyInactiveTabPane={true}
      tabBarStyle={sticky != null ? { top: sticky } : undefined}
      tabBarExtraContent={tabBarExtraContent}
    >
      {items?.map((item: TabItemWithPermissions) => {
        const {
          title,
          key,
          children,
          isClosable,
          isDisabled,
          requiredPermissions,
          Icon,
          TrailIcon,
        } = item;
        const isEnabled = requiredPermissions?.length
          ? requiredPermissions.some((permission) => permissions.get(permission))
          : true;

        return (
          <AntTabs.TabPane
            tab={
              <span className={cn(s.tab_span)} data-sentry-allow={true}>
                {Icon && <div className={cn(s.icon, s.center)}>{Icon}</div>}
                <span>{title}</span>
                {TrailIcon && <div className={cn(s.center)}>{TrailIcon}</div>}
              </span>
            }
            key={key}
            closable={isClosable}
            disabled={isDisabled ?? !isEnabled ?? false}
          >
            {children ?? <></>}
          </AntTabs.TabPane>
        );
      })}
    </AntTabs>
  );
}
