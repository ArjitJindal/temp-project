import React, { useCallback, useMemo, useState } from 'react';
import { Button, Input, message, Space, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import Table from '@/components/ui/Table';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { TransactionState, TransactionStateAlias } from '@/apis';
import { useApi } from '@/api';
import { TableColumn } from '@/components/ui/Table/types';

interface TableItem {
  state: TransactionState;
  stateAlias: string | undefined;
}

export const TransactionStateSettings: React.FC = () => {
  const api = useApi();
  const settings = useSettings();
  const [savingState, setSavingState] = useState<TransactionState | null>();
  const stateToAlias = useMemo<Map<TransactionState | undefined, string>>(
    () =>
      new Map((settings.transactionStateAlias || []).map((entry) => [entry.state, entry.alias])),
    [settings.transactionStateAlias],
  );
  const [commitedStateToAlias, setCommitedStateToAlias] = useState<
    Map<TransactionState | undefined, string>
  >(new Map());
  const savedStateToAlias = useMemo(
    () => new Map([...stateToAlias, ...commitedStateToAlias]),
    [stateToAlias, commitedStateToAlias],
  );
  const [newStateToAlias, setNewStateToAlias] = useState<Map<TransactionState, string>>(new Map());
  const handleUpdateAlias = useCallback(
    (state: TransactionState, newAlias: string) => {
      setNewStateToAlias(new Map(newStateToAlias).set(state, newAlias.trim()));
    },
    [newStateToAlias],
  );
  const handleSaveAlias = useCallback(
    async (state: TransactionState) => {
      setSavingState(state);
      try {
        const updatedStateToAlias = new Map(savedStateToAlias).set(
          state,
          newStateToAlias.get(state) || '',
        );
        const transactionStateAlias = Array.from(updatedStateToAlias.entries())
          .map((entry) => ({
            state: entry[0],
            alias: entry[1],
          }))
          .filter((item) => !!item.alias) as TransactionStateAlias[];
        await api.postTenantsSettings({ TenantSettings: { transactionStateAlias } });
        setCommitedStateToAlias(updatedStateToAlias);
        message.success('Saved');
      } catch (e) {
        message.error('Failed to save the alias');
      } finally {
        setSavingState(null);
      }
    },
    [api, newStateToAlias, savedStateToAlias],
  );
  const tableData = useMemo<TableItem[]>(
    () => [
      {
        state: 'CREATED',
        stateAlias: stateToAlias.get('CREATED'),
      },
      {
        state: 'PROCESSING',
        stateAlias: stateToAlias.get('PROCESSING'),
      },
      {
        state: 'SENT',
        stateAlias: stateToAlias.get('SENT'),
      },
      {
        state: 'EXPIRED',
        stateAlias: stateToAlias.get('EXPIRED'),
      },
      {
        state: 'SUSPENDED',
        stateAlias: stateToAlias.get('SUSPENDED'),
      },
      {
        state: 'REFUNDED',
        stateAlias: stateToAlias.get('REFUNDED'),
      },
      {
        state: 'DECLINED',
        stateAlias: stateToAlias.get('DECLINED'),
      },
      {
        state: 'SUCCESSFUL',
        stateAlias: stateToAlias.get('SUCCESSFUL'),
      },
    ],
    [stateToAlias],
  );

  const columns: TableColumn<TableItem>[] = [
    {
      title: <Typography.Text strong>State</Typography.Text>,
      width: '100px',
      dataIndex: 'state',
    },
    {
      title: (
        <Space>
          <Typography.Text strong>Alias</Typography.Text>
          <Tooltip title="Allows you to add a name that will overwrite the default Transaction state displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.">
            <QuestionCircleOutlined />
          </Tooltip>
        </Space>
      ),
      width: '200px',
      render: (_, item) => {
        return (
          <Input
            value={newStateToAlias.get(item.state) ?? item.stateAlias}
            onChange={(event) => handleUpdateAlias(item.state, event.target.value)}
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
            onClick={() => handleSaveAlias(item.state)}
            disabled={
              !!savingState ||
              newStateToAlias.get(item.state) === undefined ||
              (savedStateToAlias.get(item.state) || '') === (newStateToAlias.get(item.state) || '')
            }
            loading={item.state === savingState}
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
      rowKey="state"
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
