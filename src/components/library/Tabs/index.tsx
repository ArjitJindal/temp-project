import React from 'react';
import { Tabs as AntTabs, TabsProps } from 'antd';
import COLORS from '@/components/ui/colors';

interface TabItem {
  tab: string;
  key: string;
  children: React.ReactNode;
  isClosable?: boolean;
  isDisabled?: boolean;
}

interface Props extends TabsProps {
  items: TabItem[];
  tabHeight?: string | number;
}

export default function Tabs(props: Props) {
  const { items } = props;
  return (
    <AntTabs
      color={COLORS.brandBlue.base}
      {...props}
      style={props.tabHeight ? { height: props.tabHeight } : {}}
    >
      {items.map((item: TabItem) => {
        const { tab, key, children, isClosable, isDisabled } = item;
        return (
          <AntTabs.TabPane tab={tab} key={key} closable={isClosable} disabled={isDisabled ?? false}>
            {children}
          </AntTabs.TabPane>
        );
      })}
    </AntTabs>
  );
}
