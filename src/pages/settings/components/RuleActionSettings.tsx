import React, { useCallback, useMemo, useState } from 'react';
import { Button, Input, message, Space, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import Table from '@/components/ui/Table';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RuleAction, RuleActionAlias } from '@/apis';
import { useApi } from '@/api';
import { TableColumn } from '@/components/ui/Table/types';

interface TableItem {
  action: RuleAction;
  description: string;
  actionAlias: string | undefined;
}

export const RuleActionSettings: React.FC = () => {
  const api = useApi();
  const settings = useSettings();
  const [savingAction, setSavingAction] = useState<RuleAction | null>();
  const actionToAlias = useMemo<Map<RuleAction, string>>(
    () => new Map((settings.ruleActionAliases || []).map((entry) => [entry.action, entry.alias])),
    [settings.ruleActionAliases],
  );
  const [commitedActionToAlias, setCommitedActionToAlias] = useState<Map<RuleAction, string>>(
    new Map(),
  );
  const savedActionToAlias = useMemo(
    () => new Map([...actionToAlias, ...commitedActionToAlias]),
    [actionToAlias, commitedActionToAlias],
  );
  const [newActionToAlias, setNewActionToAlias] = useState<Map<RuleAction, string>>(new Map());
  const handleUpdateAlias = useCallback(
    (action: RuleAction, newAlias: string) => {
      setNewActionToAlias(new Map(newActionToAlias).set(action, newAlias.trim()));
    },
    [newActionToAlias],
  );
  const handleSaveAlias = useCallback(
    async (action: RuleAction) => {
      setSavingAction(action);
      try {
        const updatedActionToAlias = new Map(savedActionToAlias).set(
          action,
          newActionToAlias.get(action) || '',
        );
        const ruleActionAliases = Array.from(updatedActionToAlias.entries())
          .map((entry) => ({
            action: entry[0],
            alias: entry[1],
          }))
          .filter((item) => !!item.alias) as RuleActionAlias[];
        await api.postTenantsSettings({ TenantSettings: { ruleActionAliases } });
        setCommitedActionToAlias(updatedActionToAlias);
        message.success('Saved');
      } catch (e) {
        message.error('Failed to save the alias');
      } finally {
        setSavingAction(null);
      }
    },
    [api, newActionToAlias, savedActionToAlias],
  );
  const tableData = useMemo<TableItem[]>(
    () => [
      {
        action: 'FLAG',
        description: 'Process the transaction but generate a case for investigation.',
        actionAlias: actionToAlias.get('FLAG'),
      },
      {
        action: 'SUSPEND',
        description: 'Stop the transaction from proceeding until the investigation is completed.',
        actionAlias: actionToAlias.get('SUSPEND'),
      },
      {
        action: 'BLOCK',
        description: 'Decline the transaction automatically.',
        actionAlias: actionToAlias.get('BLOCK'),
      },
    ],
    [actionToAlias],
  );

  const columns: TableColumn<TableItem>[] = [
    {
      title: <Typography.Text strong>Action</Typography.Text>,
      width: '100px',
      dataIndex: 'action',
    },
    {
      title: <Typography.Text strong>Description</Typography.Text>,
      width: '250px',
      dataIndex: 'description',
    },
    {
      title: (
        <Space>
          <Typography.Text strong>Alias</Typography.Text>
          <Tooltip title="Allows you to add a name that will overwrite the default Action name displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.">
            <QuestionCircleOutlined />
          </Tooltip>
        </Space>
      ),
      width: '200px',
      render: (_, item) => {
        return (
          <Input
            value={newActionToAlias.get(item.action) ?? item.actionAlias}
            onChange={(event) => handleUpdateAlias(item.action, event.target.value)}
          />
        );
      },
    },
    {
      title: <Typography.Text strong>Action</Typography.Text>,
      width: '50px',
      render: (_, item) => {
        return (
          <Button
            type="primary"
            onClick={() => handleSaveAlias(item.action)}
            disabled={
              !!savingAction ||
              newActionToAlias.get(item.action) === undefined ||
              (savedActionToAlias.get(item.action) || '') ===
                (newActionToAlias.get(item.action) || '')
            }
            loading={item.action === savingAction}
          >
            Update
          </Button>
        );
      },
    },
  ];

  return (
    <Table<TableItem>
      disableStripedColoring={true}
      rowKey="action"
      headerTitle="Default Actions"
      search={false}
      columns={columns}
      pagination={'HIDE'}
      data={{
        items: tableData,
      }}
      options={{
        setting: false,
        density: false,
        reload: false,
      }}
    />
  );
};
