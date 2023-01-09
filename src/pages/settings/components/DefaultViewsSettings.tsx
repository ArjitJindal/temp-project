import { message, Tree } from 'antd';
import { useCallback, useState } from 'react';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/ui/Button';
import { useApi } from '@/api';
import { UI_SETTINGS as TRANSACTION_CASE_DETAILS_UI_SETTINGS } from '@/pages/case-management-item/TransactionCaseDetails/ui-settings';
import { UI_SETTINGS as USER_DETAILS_UI_SETTINGS } from '@/pages/users-item/ui-settings';
import { UI_SETTINGS as USER_CASE_DETAILS_UI_SETTINGS } from '@/pages/case-management-item/UserCaseDetails/ui-settings';
import { UiSettingsType } from '@/@types/ui-settings';

const ALL_UI_SETTINGS: UiSettingsType[] = [
  TRANSACTION_CASE_DETAILS_UI_SETTINGS,
  USER_CASE_DETAILS_UI_SETTINGS,
  USER_DETAILS_UI_SETTINGS,
  // Add more ui settings here
];
export const DEFAULT_EXPANDED_CARDS = ALL_UI_SETTINGS.flatMap((uiSettings) =>
  Object.values(uiSettings.cards).map((card) => card.key),
);

function uiSettingsToTreeData(settings: UiSettingsType) {
  return {
    title: settings.title,
    key: settings.title,
    children: Object.values(settings.cards),
  };
}

export const DefaultViewsSettings = () => {
  const settings = useSettings();
  const api = useApi();

  const [expandedCardKeys, setExpandedCardKeys] = useState<string[]>(
    settings?.defaultViews?.expandedCards ?? DEFAULT_EXPANDED_CARDS,
  );
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await api.postTenantsSettings({
        TenantSettings: {
          defaultViews: {
            ...settings.defaultViews,
            expandedCards: expandedCardKeys,
          },
        },
      });
      message.success('Saved');
      setSaving(false);
    } catch (e) {
      message.error('Failed to update default views');
    }
  }, [expandedCardKeys, settings.defaultViews, api]);

  return (
    <div>
      <h3>Default Views Settings</h3>
      <p>Select the following views to be displayed expanded by default:</p>
      <div style={{ marginTop: '2rem' }}>
        <Tree
          checkable
          defaultExpandAll={true}
          treeData={ALL_UI_SETTINGS.map(uiSettingsToTreeData)}
          onCheck={(checkedKeys) => {
            setExpandedCardKeys(() =>
              (checkedKeys as string[]).filter((key) =>
                ALL_UI_SETTINGS.find((uiSetting) => uiSetting.key !== key),
              ),
            );
          }}
          checkedKeys={expandedCardKeys}
        />
        <Button
          type={'primary'}
          onClick={handleSave}
          style={{ marginTop: '1rem' }}
          loading={saving}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
