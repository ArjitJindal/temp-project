import React from 'react';
import { Tabs as AntTabs, TabsProps } from 'antd';
import cn from 'clsx';
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
}

export interface Props
  extends Pick<TabsProps, 'type' | 'activeKey' | 'onChange' | 'defaultActiveKey' | 'hideAdd'> {
  items: TabItem[];
  addIcon?: React.ReactNode;
  tabHeight?: string | number;
  size?: 'large' | 'middle' | 'small';
  tabBarGutter?: number;
  tabBarExtraContent?: React.ReactNode;
  onEdit?: (action: 'add' | 'remove', key?: string) => void;
  onChange?: (key?: any) => void;
  eventData?: Record<string, any>;
}

export default function Tabs(props: Props) {
  const {
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
  } = props;

  return (
    <AntTabs
      hideAdd={hideAdd}
      activeKey={activeKey}
      type={props?.type}
      size={props?.size}
      className={cn(s.root, props.type === 'line' && s.line)}
      addIcon={addIcon}
      defaultActiveKey={defaultActiveKey ?? '1'}
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
              <span className={cn(s.tab_span)} data-sentry-allow={true}>
                {Icon && <div className={cn(s.icon)}>{Icon}</div>}
                {showBadge && <div className={cn(s.badge)} />}
                <span>{title}</span>
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
