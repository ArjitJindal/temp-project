import React from 'react';
import { Tabs as AntTabs, TabsProps } from 'antd';
import cn from 'clsx';
import SameWidthDiv from '../SameWidthDiv';
import s from './index.module.less';
import { captureTabEvent } from '@/utils/postHog';

export interface TabItem {
  title: React.ReactNode;
  key: string;
  children?: React.ReactNode;
  isClosable?: boolean;
  isDisabled?: boolean;
  showBadge?: boolean;
  Icon?: React.ReactNode;
  captureEvents?: boolean;
  TrailIcon?: React.ReactNode;
  onClick?: () => void;
}

export interface Props
  extends Pick<TabsProps, 'type' | 'activeKey' | 'onChange' | 'defaultActiveKey' | 'hideAdd'> {
  items: TabItem[];
  addIcon?: React.ReactNode;
  tabHeight?: string | number;
  size?: 'X1' | 'X2';
  orientation?: 'HORIZONTAL' | 'VERTICAL';
  tabBarGutter?: number;
  tabBarExtraContent?: React.ReactNode;
  onEdit?: (action: 'add' | 'remove', key?: string) => void;
  onChange?: (key?: any) => void;
  eventData?: Record<string, any>;
  sticky?: number;
}

export default function Tabs(props: Props) {
  const {
    type = 'line',
    items,
    addIcon,
    tabBarGutter,
    tabBarExtraContent,
    onEdit,
    onChange,
    activeKey,
    defaultActiveKey,
    hideAdd,
    eventData,
    size = 'X1',
    orientation = 'HORIZONTAL',
    sticky,
  } = props;

  return (
    <AntTabs
      hideAdd={hideAdd}
      activeKey={activeKey}
      type={type}
      tabPosition={orientation === 'HORIZONTAL' ? 'top' : 'left'}
      className={cn(
        s.root,
        sticky != null && s.isSticky,
        s[`type-${type === 'line' ? 'line' : 'card'}`],
        s[`size-${size}`],
        s[`orientation-${orientation}`],
      )}
      addIcon={addIcon}
      defaultActiveKey={defaultActiveKey ?? '1'}
      tabBarStyle={sticky != null ? { top: sticky } : undefined}
      tabBarGutter={tabBarGutter}
      onChange={(key) => {
        captureTabEvent(activeKey, key, items ?? [], { ...eventData, component: 'Tabs' });
        onChange?.(key);
      }}
      onEdit={
        onEdit
          ? (key, action) => onEdit(action, typeof key === 'string' ? key : undefined)
          : undefined
      }
      tabBarExtraContent={tabBarExtraContent}
    >
      {items.map((item: TabItem) => {
        const { title, key, children, isClosable, isDisabled, Icon, showBadge, TrailIcon } = item;
        return (
          <AntTabs.TabPane
            className={s.tab}
            tab={
              <span className={cn(s.tab_span)} data-sentry-allow={true} onClick={item.onClick}>
                {Icon && <div className={cn(s.icon)}>{Icon}</div>}
                <SameWidthDiv title={typeof title === 'string' ? title : undefined}>
                  <span className={cn(s.tabTitle)}>
                    {title}
                    {showBadge && <div className={cn(s.badge)} />}
                  </span>
                </SameWidthDiv>
                {TrailIcon && <div className={cn(s.icon)}>{TrailIcon}</div>}
              </span>
            }
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
