import Tabs, { TabItem, Props as TabsProps } from '@/components/library/Tabs';
import { captureTabEvent } from '@/utils/postHog';
import { Permission } from '@/apis';
import { hasMinimumPermission, Resource, useAuth0User } from '@/utils/user-utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useResources } from '@/components/AppWrapper/Providers/StatementsProvider';

export const TABS_LINE_HEIGHT = 81;

export type TabItemWithPermissions = TabItem & {
  requiredPermissions?: Permission[];
  minRequiredResources?: Resource[]; // The minimum permission level required to access this tab. For example, if tab requires 'write:::settings/system-config', it will be visible for users with broader permissions like 'write:::*' or 'write:::settings/*', but not for users with unrelated permissions like 'write:::case-management/*'
};

interface Props extends Omit<TabsProps, 'items'> {
  items?: TabItemWithPermissions[];
  compact?: boolean;
  eventData?: Record<string, any>;
}

export default function PageTabs(props: Props) {
  const user = useAuth0User();
  const permissions = user?.permissions ?? new Map<Permission, boolean>();
  const { compact, activeKey, items, onChange, eventData, ...restProps } = props;
  const isRBACV2Enabled = useFeatureEnabled('RBAC_V2');
  const { statements } = useResources();

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
          const isEnabled =
            isRBACV2Enabled && item.minRequiredResources
              ? hasMinimumPermission(statements, item.minRequiredResources)
              : item.requiredPermissions?.length
              ? item.requiredPermissions.some((permission) => permissions.get(permission))
              : true;

          return {
            ...item,
            ...(isRBACV2Enabled && item.minRequiredResources
              ? { isDisabled: !isEnabled }
              : { isEnabled }),
          };
        }) ?? []
      }
    />
  );
}
