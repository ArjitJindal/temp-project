import { Tree } from 'antd';
import { useCallback, useState } from 'react';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import { UI_SETTINGS as TRANSACTION_CASE_DETAILS_UI_SETTINGS } from '@/pages/case-management-item/TransactionCaseDetails/ui-settings';
import { UI_SETTINGS as USER_DETAILS_UI_SETTINGS } from '@/pages/users-item/ui-settings';
import { UI_SETTINGS as USER_CASE_DETAILS_UI_SETTINGS } from '@/pages/case-management-item/CaseDetails/ui-settings';
import { UiSettingsType } from '@/@types/ui-settings';

const ALL_UI_SETTINGS: UiSettingsType[] = [
  TRANSACTION_CASE_DETAILS_UI_SETTINGS,
  USER_CASE_DETAILS_UI_SETTINGS,
  USER_DETAILS_UI_SETTINGS,
];

function uiSettingsToTreeData(settings: UiSettingsType) {
  return {
    title: settings.title,
    key: settings.title,
    children: Object.values(settings.cards),
  };
}

export const DefaultViewsSettings = () => {
  const settings = useSettings();
  const [expandedCardKeys, setExpandedCardKeys] = useState<string[]>(
    settings?.defaultViews?.expandedCards ?? [],
  );

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSave = useCallback(async () => {
    mutateTenantSettings.mutate({
      defaultViews: {
        ...settings.defaultViews,
        expandedCards: expandedCardKeys,
      },
    });
  }, [mutateTenantSettings, settings.defaultViews, expandedCardKeys]);

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
          type="PRIMARY"
          onClick={handleSave}
          style={{ marginTop: '1rem' }}
          isLoading={mutateTenantSettings.isLoading}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
