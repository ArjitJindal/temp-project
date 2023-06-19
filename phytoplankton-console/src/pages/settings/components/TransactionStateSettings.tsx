import React, { useCallback, useMemo, useState } from 'react';
import { Button, Input } from 'antd';
import Table from '@/components/library/Table';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { TransactionState, TransactionStateAlias } from '@/apis';
import { useApi } from '@/api';
import { TableColumn } from '@/components/library/Table/types';
import { message } from '@/components/library/Message';
import { H4 } from '@/components/ui/Typography';
import { ColumnHelper } from '@/components/library/Table/columnHelper';

interface TableItem {
  state: TransactionState;
  description: string;
  stateAlias: string | undefined;
}

interface ExternalState {
  newStateToAlias: Map<TransactionState, string>;
  savedStateToAlias: Map<TransactionState | undefined, string>;
  savingState: TransactionState | null;
  onUpdateAlias: (state: TransactionState, newAlias: string) => void;
  onSaveAlias: (state: TransactionState) => void;
}

const columnHelper = new ColumnHelper<TableItem>();
const columns: TableColumn<TableItem>[] = columnHelper.list([
  columnHelper.simple({
    title: 'State',
    key: 'state',
    defaultWidth: 100,
  }),
  columnHelper.simple({
    title: 'Description',
    key: 'description',
    defaultWidth: 250,
  }),
  columnHelper.display({
    title: 'Alias',
    tooltip:
      'Allows you to add a name that will overwrite the default Transaction state displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.',
    defaultWidth: 200,
    render: (item, context) => {
      const externalState: ExternalState = context.external as ExternalState;
      const { newStateToAlias, onUpdateAlias } = externalState;
      return (
        <Input
          value={newStateToAlias.get(item.state) ?? item.stateAlias}
          onChange={(event) => onUpdateAlias(item.state, event.target.value)}
        />
      );
    },
  }),
  columnHelper.display({
    title: 'Action',
    defaultWidth: 50,
    render: (item, context) => {
      const externalState: ExternalState = context.external as ExternalState;
      const { newStateToAlias, savingState, savedStateToAlias, onSaveAlias } = externalState;
      return (
        <Button
          type="primary"
          onClick={() => onSaveAlias(item.state)}
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
  }),
]);

export const TransactionStateSettings: React.FC = () => {
  const api = useApi();
  const settings = useSettings();
  const [savingState, setSavingState] = useState<TransactionState | null>(null);
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
        message.fatal('Failed to save the alias', e);
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
        description: 'When a transaction is initiated in your system.',
        stateAlias: stateToAlias.get('CREATED'),
      },
      {
        state: 'PROCESSING',
        description: 'When a transaction is under process.',
        stateAlias: stateToAlias.get('PROCESSING'),
      },
      {
        state: 'SENT',
        description: 'When a transaction is successful from the initiator.',
        stateAlias: stateToAlias.get('SENT'),
      },
      {
        state: 'EXPIRED',
        description: 'When a transaction is not settled.',
        stateAlias: stateToAlias.get('EXPIRED'),
      },
      {
        state: 'SUSPENDED',
        description: 'When a transaction is temporary on hold.',
        stateAlias: stateToAlias.get('SUSPENDED'),
      },
      {
        state: 'REFUNDED',
        description: 'When a transaction amount is processed back to the initiator.',
        stateAlias: stateToAlias.get('REFUNDED'),
      },
      {
        state: 'DECLINED',
        description: 'When a transaction is not processed.',
        stateAlias: stateToAlias.get('DECLINED'),
      },
      {
        state: 'SUCCESSFUL',
        description: 'When a transaction is completed successfully.',
        stateAlias: stateToAlias.get('SUCCESSFUL'),
      },
    ],
    [stateToAlias],
  );

  const externalState: ExternalState = {
    newStateToAlias,
    savingState,
    savedStateToAlias,
    onUpdateAlias: handleUpdateAlias,
    onSaveAlias: handleSaveAlias,
  };
  return (
    <>
      <H4>Default State</H4>
      <Table<TableItem>
        rowKey="state"
        columns={columns}
        pagination={false}
        data={{
          items: tableData,
        }}
        toolsOptions={false}
        externalState={externalState}
      />
    </>
  );
};
