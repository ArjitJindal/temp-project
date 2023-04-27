import { Tabs, TabsProps } from 'antd';
import cn from 'clsx';
import s from './index.module.less';

export const TABS_LINE_HEIGHT = 81;

interface Props extends TabsProps {
  sticky?: number;
  compact?: boolean;
}

export default function PageTabs(props: Props) {
  const { sticky, compact } = props;
  return (
    <Tabs
      className={cn(s.root, { [s.compact]: compact, [s.isSticky]: sticky != null })}
      type="line"
      destroyInactiveTabPane={true}
      tabBarStyle={sticky != null ? { top: sticky } : undefined}
      {...props}
    >
      {props.children}
    </Tabs>
  );
}
