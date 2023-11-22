import { Tabs as AntTabs, TabsProps } from 'antd';
import cn from 'clsx';
import { TabsType } from 'antd/lib/tabs';
import React from 'react';
import s from './index.module.less';
import { TabItem } from '@/components/library/Tabs';

export const TABS_LINE_HEIGHT = 81;

interface Props extends Pick<TabsProps, 'activeKey' | 'onChange' | 'tabBarExtraContent'> {
  items?: TabItem[];
  sticky?: number;
  compact?: boolean;
  isPrimary?: boolean;
  type?: TabsType;
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
  } = props;
  return (
    <AntTabs
      className={cn(s.root, {
        [s.compact]: compact,
        [s.isSticky]: sticky != null,
        [s.isPrimary]: isPrimary,
      })}
      activeKey={activeKey}
      onChange={onChange}
      type={type}
      destroyInactiveTabPane={true}
      tabBarStyle={sticky != null ? { top: sticky } : undefined}
      tabBarExtraContent={tabBarExtraContent}
    >
      {items?.map((item: TabItem) => {
        const { title, key, children, isClosable, isDisabled } = item;
        return (
          <AntTabs.TabPane
            tab={title}
            key={key}
            closable={isClosable}
            disabled={isDisabled ?? false}
          >
            {children ?? <></>}
          </AntTabs.TabPane>
        );
      })}
    </AntTabs>
  );
}
