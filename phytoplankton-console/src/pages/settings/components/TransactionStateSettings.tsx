import React, { useCallback, useMemo, useState } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { TransactionState, TransactionStateAlias } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Button from '@/components/library/Button';
import { STRING } from '@/components/library/Table/standardDataTypes';

interface TableItem {
  state: TransactionState;
  description: string;
  stateAlias: string | undefined;
}

const columnHelper = new ColumnHelper<TableItem>();

export const TransactionStateSettings: React.FC = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const [savingState, setSavingState] = useState<TransactionState | null>(null);
  const [commitedStateToAlias, setCommitedStateToAlias] = useState<
    Map<TransactionState | undefined, string>
  >(new Map());

  const stateToAlias = useMemo<Map<TransactionState | undefined, string>>(
    () =>
      new Map((settings.transactionStateAlias || []).map((entry) => [entry.state, entry.alias])),
    [settings.transactionStateAlias],
  );

  const savedStateToAlias = useMemo(
    () => new Map([...stateToAlias, ...commitedStateToAlias]),
    [stateToAlias, commitedStateToAlias],
  );
  const handleSaveAlias = useCallback(
    async (state: TransactionState, newAlias: string) => {
      setSavingState(state);
      try {
        const updatedStateToAlias = new Map(savedStateToAlias).set(state, newAlias);
        const transactionStateAlias = Array.from(updatedStateToAlias.entries())
          .map((entry) => ({
            state: entry[0],
            alias: entry[1],
          }))
          .filter((item) => !!item.alias) as TransactionStateAlias[];
        await mutateTenantSettings.mutateAsync({ transactionStateAlias });
        setCommitedStateToAlias(updatedStateToAlias);
      } finally {
        setSavingState(null);
      }
    },
    [mutateTenantSettings, savedStateToAlias],
  );

  const columns = useMemo(
    () =>
      columnHelper.list([
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
        columnHelper.simple({
          title: 'Alias',
          key: 'stateAlias',
          tooltip:
            'Allows you to add a name that will overwrite the default Transaction state displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.',
          defaultWidth: 200,
          type: STRING,
          defaultEditState: true,
        }),
        columnHelper.display({
          title: 'Action',
          enableResizing: false,
          render: (item, ctx) => {
            const rowApi = ctx.rowApi;
            const draft = (rowApi?.getDraft?.() as TableItem) ?? item;
            const isBusy = Boolean(rowApi?.isBusy);
            const isDirty = (draft.stateAlias ?? '') !== (item.stateAlias ?? '');
            return (
              <Button
                type="PRIMARY"
                onClick={() => rowApi?.save?.()}
                isDisabled={!isDirty}
                isLoading={isBusy || item.state === savingState}
                requiredResources={['write:::settings/transactions/*']}
              >
                Update
              </Button>
            );
          },
        }),
      ]),
    [savingState],
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
      {
        state: 'REVERSED',
        description: 'When a transaction is reversed.',
        stateAlias: stateToAlias.get('REVERSED'),
      },
    ],
    [stateToAlias],
  );

  return (
    <SettingsCard
      title="Transaction state alias"
      description="Configure transaction states display name in console"
      minRequiredResources={['read:::settings/transactions/transaction-state-alias/*']}
    >
      <Table<TableItem>
        rowKey="state"
        columns={columns}
        pagination={false}
        data={{
          items: tableData,
        }}
        rowEditing={{
          mode: 'single',
          onSave: async (rowKey, drafted) => {
            await handleSaveAlias(rowKey as TransactionState, drafted.stateAlias ?? '');
          },
        }}
        toolsOptions={false}
      />
    </SettingsCard>
  );
};
