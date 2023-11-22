import React from 'react';
import { Tabs as AntTabs, TabsProps } from 'antd';
import cn from 'clsx';
import s from './index.module.less';

export interface TabItem {
  title: React.ReactNode;
  key: string;
  children?: React.ReactNode;
  isClosable?: boolean;
  isDisabled?: boolean;
  Icon?: React.ReactNode;
}

interface Props extends Pick<TabsProps, 'type' | 'activeKey' | 'onChange'> {
  items: TabItem[];
  addIcon?: React.ReactNode;
  tabHeight?: string | number;
  size?: 'large' | 'middle' | 'small';
  tabBarGutter?: number;
  onEdit?: (action: 'add' | 'remove', key?: string) => void;
  onChange?: (key?: any) => void;
}

export default function Tabs(props: Props) {
  const { items, addIcon, tabBarGutter, onEdit, onChange, activeKey } = props;

  return (
    <AntTabs
      activeKey={activeKey}
      style={{ maxHeight: props.tabHeight, overflow: 'auto' }}
      type={props?.type}
      size={props?.size}
      className={cn(props.type === 'line' ? s.root : '')}
      addIcon={addIcon}
      defaultActiveKey="1"
      tabBarGutter={tabBarGutter}
      onChange={onChange ? (key) => onChange(key) : undefined}
      onEdit={
        onEdit
          ? (key, action) => onEdit(action, typeof key === 'string' ? key : undefined)
          : undefined
      }
    >
      {items.map((item: TabItem) => {
        const { title, key, children, isClosable, isDisabled, Icon } = item;
        return (
          <AntTabs.TabPane
            tab={
              <span className={cn(s.root, s.tab_span)}>
                {Icon && <div className={cn(s.root, s.icon)}>{Icon}</div>}
                <span>{title}</span>
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
