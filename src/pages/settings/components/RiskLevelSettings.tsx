import React, { useCallback, useMemo, useState } from 'react';
import { Button, Input, message, Space, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import Table from '@/components/ui/Table';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel, RiskLevelAlias } from '@/apis';
import { useApi } from '@/api';
import { TableColumn } from '@/components/ui/Table/types';

interface TableItem {
  level: RiskLevel;
  levelAlias: string | undefined;
}

export const RiskLevelSettings: React.FC = () => {
  const api = useApi();
  const settings = useSettings();
  const [savingLevel, setSavingLevel] = useState<RiskLevel | null>();
  const levelToAlias = useMemo<Map<RiskLevel | undefined, string>>(
    () => new Map((settings.riskLevelAlias || []).map((entry) => [entry.level, entry.alias])),
    [settings.riskLevelAlias],
  );
  const [commitedLevelToAlias, setCommitedLevelToAlias] = useState<
    Map<RiskLevel | undefined, string>
  >(new Map([...levelToAlias]));
  const savedLevelToAlias = useMemo(
    () => new Map([...levelToAlias, ...commitedLevelToAlias]),
    [levelToAlias, commitedLevelToAlias],
  );
  const [newLevelToAlias, setNewLevelToAlias] = useState<Map<RiskLevel | undefined, string>>(
    new Map([...levelToAlias]),
  );
  const handleUpdateAlias = useCallback(
    (level: RiskLevel, newAlias: string) => {
      setNewLevelToAlias(new Map(newLevelToAlias).set(level, newAlias.trim()));
    },
    [newLevelToAlias],
  );
  const handleSaveAlias = useCallback(
    async (level: RiskLevel) => {
      setSavingLevel(level);
      try {
        const updatedLevelToAlias = new Map(savedLevelToAlias).set(
          level,
          newLevelToAlias.get(level) || '',
        );
        const riskLevelAlias = Array.from(updatedLevelToAlias.entries())
          .map((entry) => ({
            level: entry[0],
            alias: entry[1],
          }))
          .filter((item) => !!item.alias) as RiskLevelAlias[];
        await api.postTenantsSettings({ TenantSettings: { riskLevelAlias } });
        setCommitedLevelToAlias(updatedLevelToAlias);
        message.success('Saved');
      } catch (e) {
        message.error('Failed to save the alias');
      } finally {
        setSavingLevel(null);
      }
    },
    [api, newLevelToAlias, savedLevelToAlias],
  );
  const tableData = useMemo<TableItem[]>(
    () => [
      {
        level: 'VERY_HIGH',
        levelAlias: levelToAlias.get('VERY_LOW'),
      },
      {
        level: 'HIGH',
        levelAlias: levelToAlias.get('HIGH'),
      },
      {
        level: 'MEDIUM',
        levelAlias: levelToAlias.get('MEDIUM'),
      },
      {
        level: 'LOW',
        levelAlias: levelToAlias.get('LOW'),
      },
      {
        level: 'VERY_LOW',
        levelAlias: levelToAlias.get('VERY_LOW'),
      },
    ],
    [levelToAlias],
  );

  const columns: TableColumn<TableItem>[] = [
    {
      title: <Typography.Text strong>Level</Typography.Text>,
      width: '100px',
      dataIndex: 'level',
    },
    {
      title: (
        <Space>
          <Typography.Text strong>Alias</Typography.Text>
          <Tooltip title="Allows you to add a name that will overwrite the default Risk level displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.">
            <QuestionCircleOutlined />
          </Tooltip>
        </Space>
      ),
      width: '200px',
      render: (_, item) => {
        return (
          <Input
            value={newLevelToAlias.get(item.level) ?? item.levelAlias}
            onChange={(event) => handleUpdateAlias(item.level, event.target.value)}
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
            onClick={() => handleSaveAlias(item.level)}
            disabled={
              !!savingLevel ||
              newLevelToAlias.get(item.level) === undefined ||
              (savedLevelToAlias.get(item.level) || '') === (newLevelToAlias.get(item.level) || '')
            }
            loading={item.level === savingLevel}
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
      rowKey="level"
      headerTitle="Default State"
      search={false}
      columns={columns}
      pagination={false}
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
