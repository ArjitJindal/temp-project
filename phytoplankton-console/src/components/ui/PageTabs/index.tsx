import { Tabs as AntTabs, TabsProps } from 'antd';
import cn from 'clsx';
import { TabsType } from 'antd/lib/tabs';
import React from 'react';
import s from './index.module.less';
import { TabItem } from '@/components/library/Tabs';
import { captureTabEvent } from '@/utils/postHog';
import { Permission } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';

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
        return <PageTab {...item} />;
      })}
    </AntTabs>
  );
}

export const PageTab = (props: TabItemWithPermissions) => {
  const { title, key, children, isClosable, isDisabled, requiredPermissions } = props;

  const isEnabledByPermissions = useHasPermissions(requiredPermissions ?? []);

  return (
    <AntTabs.TabPane
      tab={<span data-sentry-allow={true}>{title}</span>}
      key={key}
      closable={isClosable}
      disabled={isDisabled ?? !isEnabledByPermissions ?? false}
    >
      {children ?? <></>}
    </AntTabs.TabPane>
  );
};
