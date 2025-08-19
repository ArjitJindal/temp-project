import { Resource } from '@flagright/lib/utils';
import Tabs, { TabItem, Props as TabsProps } from '@/components/library/Tabs';
import { captureTabEvent } from '@/utils/postHog';
import { hasMinimumPermission } from '@/utils/user-utils';
import { useResources } from '@/components/AppWrapper/Providers/SettingsProvider';

export const TABS_LINE_HEIGHT = 81;

export type TabItemWithPermissions = TabItem & {
  minRequiredResources?: Resource[]; // The minimum permission level required to access this tab. For example, if tab requires 'write:::settings/system-config', it will be visible for users with broader permissions like 'write:::*' or 'write:::settings/*', but not for users with unrelated permissions like 'write:::case-management/*'
};

interface Props extends Omit<TabsProps, 'items'> {
  items?: TabItemWithPermissions[];
  compact?: boolean;
  eventData?: Record<string, any>;
}

export default function PageTabs(props: Props) {
  const { compact, activeKey, items, onChange, eventData, ...restProps } = props;
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
          const isEnabled = item.minRequiredResources
            ? hasMinimumPermission(statements, item.minRequiredResources)
            : true;

          return {
            ...item,
            ...(item.minRequiredResources ? { isDisabled: !isEnabled } : { isEnabled }),
          };
        }) ?? []
      }
    />
  );
}
