import Tabs, { TabItem, Props as TabsProps } from '@/components/library/Tabs';
import { captureTabEvent } from '@/utils/postHog';
import { Permission } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';

export const TABS_LINE_HEIGHT = 81;

export type TabItemWithPermissions = TabItem & { requiredPermissions?: Permission[] };

interface Props extends Omit<TabsProps, 'items'> {
  items?: TabItemWithPermissions[];
  compact?: boolean;
  eventData?: Record<string, any>;
}

export default function PageTabs(props: Props) {
  const user = useAuth0User();
  const permissions = user?.permissions ?? new Map<Permission, boolean>();
  const { compact, activeKey, items, onChange, eventData, ...restProps } = props;
  return (
    <Tabs
      {...restProps}
      size={compact ? 'X1' : 'X2'}
      activeKey={activeKey}
      onChange={(key) => {
        captureTabEvent(activeKey, key, items ?? [], { ...eventData, component: 'PageTabs' });
        onChange?.(key);
      }}
      items={
        items?.map((item) => {
          const isEnabled = item.requiredPermissions?.length
            ? item.requiredPermissions.some((permission) => permissions.get(permission))
            : true;
          return { ...item, isEnabled: isEnabled };
        }) ?? []
      }
    />
  );
}
