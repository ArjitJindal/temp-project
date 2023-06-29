import React from 'react';
import { Tabs as AntTabs, TabsProps } from 'antd';
import cn from 'clsx';
import s from './index.module.less';
import COLORS from '@/components/ui/colors';

export interface TabItem {
  tab: string;
  key: string;
  children?: React.ReactNode;
  isClosable?: boolean;
  isDisabled?: boolean;
}

interface Props extends Pick<TabsProps, 'type' | 'activeKey' | 'onChange'> {
  items: TabItem[];
  tabHeight?: string | number;
  onEdit?: (action: 'add' | 'remove', key?: string) => void;
}

export default function Tabs(props: Props) {
  const { items, onEdit, ...rest } = props;
  const noChildren = items.every((x) => x.children == null);
  return (
    <AntTabs
      {...rest}
      color={COLORS.brandBlue.base}
      className={cn(s.root, noChildren && s.noChildren)}
      style={props.tabHeight ? { height: props.tabHeight } : {}}
      onEdit={
        onEdit
          ? (e, action) => {
              if (action === 'add') {
                onEdit(action);
              } else if (action === 'remove') {
                onEdit(action, typeof e === 'string' ? e : undefined);
              }
            }
          : undefined
      }
    >
      {items.map((item: TabItem) => {
        const { tab, key, children, isClosable, isDisabled } = item;
        return (
          <AntTabs.TabPane tab={tab} key={key} closable={isClosable} disabled={isDisabled ?? false}>
            {children ?? <></>}
          </AntTabs.TabPane>
        );
      })}
    </AntTabs>
  );
}
