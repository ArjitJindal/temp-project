import React, { useCallback, useMemo, useState } from 'react';
import { Input } from 'antd';
import SettingsCard from '@/components/library/SettingsCard';
import Table from '@/components/library/Table';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { RuleAction, RuleActionAlias } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Button from '@/components/library/Button';
import { useHasPermissions } from '@/utils/user-utils';

interface TableItem {
  action: RuleAction;
  description: string;
  actionAlias: string | undefined;
}

interface ExternalState {
  savingAction: RuleAction | null;
  newActionToAlias: Map<RuleAction, string>;
  savedActionToAlias: Map<RuleAction, string>;
  onUpdateAlias: (action: RuleAction, newAlias: string) => void;
  onSaveAlias: (action: RuleAction) => void;
}

const columnHelper = new ColumnHelper<TableItem>();

export const RuleActionSettings: React.FC = () => {
  const settings = useSettings();
  const permissions = useHasPermissions(
    ['settings:rules:write'],
    ['write:::settings/rules/rule-action-alias/*'],
  );
  const columns = useMemo(
    () =>
      columnHelper.list([
        columnHelper.simple({
          key: 'action',
          title: 'Action',
          defaultWidth: 100,
        }),
        columnHelper.simple({
          key: 'description',
          title: 'Description',
          defaultWidth: 250,
        }),
        columnHelper.display({
          title: 'Alias',
          tooltip:
            'Allows you to add a name that will overwrite the default Action name displayed in the Console. The Alias name is only used in the Console and will have no impact on the API.',
          defaultWidth: 200,
          render: (item, context) => {
            const externalState = context.external as ExternalState;
            const { newActionToAlias, onUpdateAlias } = externalState;
            return (
              <Input
                value={newActionToAlias.get(item.action) ?? item.actionAlias}
                onChange={(event) => onUpdateAlias(item.action, event.target.value)}
                disabled={!permissions}
              />
            );
          },
        }),
        columnHelper.display({
          title: 'Action',
          enableResizing: false,
          render: (item, context) => {
            const externalState = context.external as ExternalState;
            const { newActionToAlias, savingAction, savedActionToAlias, onSaveAlias } =
              externalState;
            return (
              <Button
                type="PRIMARY"
                onClick={() => onSaveAlias(item.action)}
                isDisabled={
                  !!savingAction ||
                  newActionToAlias.get(item.action) === undefined ||
                  (savedActionToAlias.get(item.action) || '') ===
                    (newActionToAlias.get(item.action) || '') ||
                  !permissions
                }
                isLoading={item.action === savingAction}
                requiredPermissions={['settings:rules:write']}
                requiredResources={['write:::settings/rules/*']}
              >
                Update
              </Button>
            );
          },
        }),
      ]),
    [permissions],
  );
  const [savingAction, setSavingAction] = useState<RuleAction | null>(null);
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
  const mutateTenantSettings = useUpdateTenantSettings();
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
        await mutateTenantSettings.mutateAsync({ ruleActionAliases });
        setCommitedActionToAlias(updatedActionToAlias);
      } finally {
        setSavingAction(null);
      }
    },
    [mutateTenantSettings, newActionToAlias, savedActionToAlias],
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

  const externalState: ExternalState = {
    newActionToAlias,
    savingAction,
    savedActionToAlias,
    onUpdateAlias: handleUpdateAlias,
    onSaveAlias: handleSaveAlias,
  };
  return (
    <SettingsCard
      title="Rule action alias"
      description="Configure rule actions display name in console"
      minRequiredResources={['read:::settings/rules/rule-action-alias/*']}
    >
      <Table<TableItem>
        rowKey="action"
        columns={columns}
        pagination={false}
        data={{
          items: tableData,
        }}
        toolsOptions={false}
        externalState={externalState}
      />
    </SettingsCard>
  );
};
