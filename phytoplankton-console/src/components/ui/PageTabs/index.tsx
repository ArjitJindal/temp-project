import { Tabs, TabsProps } from 'antd';
import cn from 'clsx';
import { TabsType } from 'antd/lib/tabs';
import s from './index.module.less';

export const TABS_LINE_HEIGHT = 81;

interface Props extends TabsProps {
  sticky?: number;
  compact?: boolean;
  isPrimary?: boolean;
  type?: TabsType;
}

export default function PageTabs(props: Props) {
  const { sticky, compact, isPrimary = true, type = 'line', ...rest } = props;
  return (
    <Tabs
      className={cn(s.root, {
        [s.compact]: compact,
        [s.isSticky]: sticky != null,
        [s.isPrimary]: isPrimary,
      })}
      type={type}
      destroyInactiveTabPane={true}
      tabBarStyle={sticky != null ? { top: sticky } : undefined}
      {...rest}
    >
      {props.children}
    </Tabs>
  );
}
